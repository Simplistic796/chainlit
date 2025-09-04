// src/index.ts
import "dotenv/config";

// Global crash handlers - must be first
process.on("uncaughtException", (err) => {
  console.error("[fatal] uncaughtException:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[fatal] unhandledRejection:", reason);
  process.exit(1);
});

import { env } from "./config/env";
import express from "express";
import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "./db/prisma";
import { analyzeToken } from "./lib/scoring/scoring";
import { enqueueAnalyze, analyzeEvents } from "./jobs/queue";
import { cacheGetJSON } from "./cache/redis";
import { enqueueDebate } from "./jobs/consensus/queue";
import { logger } from "./observability/logger";
import { initSentry } from "./observability/sentry";
import { ols } from "./lib/quant/regression";
import * as Sentry from "@sentry/node";
import pinoHttp from "pino-http";
import { v4 as uuidv4 } from "uuid";
import { apiAuth, logApiUsage, ok, fail } from "./api/mw";
import { scheduleDaily, dailyWorker } from "./jobs/backtest/dailySignals";
import { scheduleAlertEvaluator } from "./jobs/alerts/evaluator";
import swaggerUi from "swagger-ui-express";
import { loadOpenApiV1 } from "./docs/openapi";
import path from "path";
import { APP_VERSION } from "./version";
import { getRedis } from "./cache/redis";
import { audit } from "./audit/log";

const app = express();
const port = env.PORT;

// Boot banner
console.log("[boot] starting server…", {
  node: process.version,
  env: env.NODE_ENV,
});

// Initialize Sentry + logging
initSentry();

// Debug environment variables
console.log("Environment check:");
console.log("DEMO_API_KEY:", env.DEMO_API_KEY ? "SET" : "NOT SET");
console.log("NODE_ENV:", env.NODE_ENV);
console.log("DATABASE_URL:", env.DATABASE_URL ? "SET" : "NOT SET");

// Sentry request/tracing handlers FIRST (only if Sentry is available)
// TODO: Fix Sentry v10+ integration
// if (process.env.SENTRY_DSN) {
//   app.use(Sentry.requestHandler());
//   app.use(Sentry.tracingHandler());
// }

// Request ID + pino logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  (req as any).id = (req.headers["x-request-id"] as string) ?? uuidv4();
  next();
});

// Response time middleware for latency capture
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1e6;
    (req as any)._latencyMs = ms;
  });
  next();
});
app.use(
  pinoHttp({
    logger,
    customProps: (req) => ({ reqId: (req as any).id }),
  })
);

// CORS: allow localhost and an optional frontend origin from env
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
].concat(env.FRONTEND_ORIGIN ? [env.FRONTEND_ORIGIN] : []);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // non-browser or same-origin
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Do not throw; reject CORS headers without breaking the route
    return callback(null, false);
  },
  methods: ["GET","POST","PATCH","DELETE","OPTIONS"],
  credentials: false,
}));
// Explicitly handle preflight for all routes
app.options("*", cors());
app.use(helmet());
app.set("trust proxy", 1);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(apiLimiter);

// Stripe webhook MUST receive the raw body. Mount BEFORE express.json.
import { stripeWebhook } from "./api/stripeWebhook";
app.post("/webhooks/stripe", bodyParser.raw({ type: "application/json" }), stripeWebhook);

app.use(express.json({ limit: "10mb" }));

app.get("/health", (req: Request, res: Response) => {
  res.send("Server is running 🚀");
});

// OpenAPI JSON (v1)
app.get("/v1/openapi.json", (_req: Request, res: Response) => {
  try {
    res.json(loadOpenApiV1());
  } catch (e: any) {
    res.status(500).json({ ok: false, error: "openapi_load_failed", details: e?.message ?? String(e) });
  }
});

// Swagger UI at /docs (load via JSON endpoint to avoid startup load failures)
app.use("/docs", swaggerUi.serve, swaggerUi.setup(undefined, {
  swaggerOptions: { url: "/v1/openapi.json", persistAuthorization: true }
}));

// Postman collection
app.get("/postman.json", (_req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), "public", "postman", "chainlit-v1.postman_collection.json"));
});

// Schema to validate query ?token=...
const AnalyzeQuery = z.object({
  token: z.string().min(1, "token is required"),
});

// GET /analyze?token=ETH
app.get("/analyze", async (req: Request, res: Response) => {
  const token = String((req.query as any).token || "").trim();
  if (!token) return res.status(400).json({ error: "token is required" });

  const key = `analysis:${token.toLowerCase()}`;

  // 1) Serve from cache if hot
  try {
    const cached = await cacheGetJSON<any>(key);
    if (cached) return res.json(cached);
  } catch {}

  // 2) If Redis is available, enqueue a job and wait briefly for it to finish
  try {
    const r = getRedis();
    if (r && analyzeEvents) {
      const job = await enqueueAnalyze(token);
      const result = await job.waitUntilFinished(analyzeEvents as any, 8000).catch(() => null);
      if (result) return res.json(result);
      const after = await cacheGetJSON<any>(key);
      if (after) return res.json(after);
    }
  } catch (e) {
    logger.warn({ err: e }, "Job path failed, falling back inline");
  }

  // 3) Fallback: run inline
  try {
    const result = await analyzeToken(token);
    return res.json(result);
  } catch (e) {
    logger.error({ err: e }, "Inline analyze failed");
    return res.status(500).json({ error: "analysis failed" });
  }
});

// GET /recent -> last 3 lookups
app.get("/recent", async (_req: Request, res: Response) => {
  const rows = await prisma.tokenLookup.findMany({
    take: 3,
    orderBy: { createdAt: "desc" },
  });
  return res.json(rows);
});

// POST /jobs/analyze { token }
app.post("/jobs/analyze", async (req: Request, res: Response) => {
  const token = String(req.body?.token || "").trim();
  if (!token) return res.status(400).json({ error: "token is required" });
  try {
    const job = await enqueueAnalyze(token);
    return res.json({ jobId: job.id });
  } catch (e: any) {
    logger.error({ err: e }, "enqueue error");
    return res.status(500).json({ error: "failed to enqueue" });
  }
});

const DebateRequest = z.object({ token: z.string().min(1), rounds: z.number().int().min(1).max(5).optional() });

// start debate
app.post("/debate", async (req: Request, res: Response) => {
  const parsed = DebateRequest.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const job = await enqueueDebate({ token: parsed.data.token, context: {} }, { attempts: 1 });
  return res.json({ jobId: job.id });
});

// fetch last consensus for a token
app.get("/consensus/:token", async (req: Request, res: Response) => {
  const token = String(req.params.token);
  const row = await (prisma as any).consensusRun.findFirst({
    where: { token },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return res.status(404).json({ error: "No consensus yet" });
  return res.json(row);
});

// Get recent agent opinions for a token (last 12 by default)
app.get("/consensus/:token/opinions", async (req: Request, res: Response) => {
  const token = String(req.params.token).trim();
  const limit = Number(req.query.limit ?? 12);
  const rows = await (prisma as any).agentRun.findMany({
    where: { token },
    orderBy: { createdAt: "desc" },
    take: Math.max(3, Math.min(30, limit)),
  });
  // Map to a clean shape
  const opinions = rows.map((r: any) => ({
    id: r.id,
    agentType: r.agentType,
    output: r.outputJSON,      // { agent, stance, confidence, rationale, features }
    createdAt: r.createdAt,
  }));
  res.json({ token, opinions });
});

// V1 API Routes (secured with API keys)
const v1 = express.Router();

// secure all v1 endpoints
v1.use(apiAuth, logApiUsage);
// --- Stripe checkout route (subscription) ---
import Stripe from "stripe";
const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" }) : null;

v1.post("/checkout", async (req, res) => {
  if (!stripe) return fail(res, 500, "stripe_not_configured");
  const email = String(req.body?.email || "").trim();
  if (!email) return fail(res, 400, "email_required");
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [{ price: String(env.STRIPE_PRICE_ID || ""), quantity: 1 }],
      success_url: String(process.env.FRONTEND_SUCCESS_URL || "http://localhost:5173/success?session_id={CHECKOUT_SESSION_ID}"),
      cancel_url: String(process.env.FRONTEND_CANCEL_URL || "http://localhost:5173/cancel"),
    });
    return ok(res, { url: session.url });
  } catch (e: any) {
    return fail(res, 500, "stripe_error", e.message);
  }
});

// UI Routes (server-owned, no auth header needed)
const ui = express.Router();

// attach the demo ApiKey object to req (like apiAuth would do)
ui.use(async (req, res, next) => {
  try {
    // Inline uiKey logic to avoid import issues
    let cached: any = null;
    if (cached) {
      (req as any).apiKey = cached;
      return next();
    }
    
    const raw = process.env.DEMO_API_KEY || "";
    console.log("DEMO_API_KEY:", raw ? "SET" : "NOT SET");
    if (!raw) throw new Error("DEMO_API_KEY not set");
    
    const { hashKey } = await import("./api/auth");
    const keyHash = hashKey(raw);
    console.log("Looking for key hash:", keyHash);
    
    const key = await prisma.apiKey.findFirst({ where: { keyHash, isActive: true } });
    if (!key) throw new Error("DEMO_API_KEY hash not found in DB (make sure you created the key)");
    console.log("Found API key:", key.id);
    
    cached = key;
    (req as any).apiKey = key;
    next();
  } catch (e: any) {
    console.error("UI key error:", e);
    return res.status(500).json({ ok: false, error: "ui_key_missing" });
  }
});

// Optional: record usage for analytics
ui.use(logApiUsage);

// GET /ui/account - returns current user's plan
ui.get("/account", async (req, res) => {
  const key = (req as any).apiKey; // this is the DEMO key holder user
  if (!key?.id) return res.status(500).json({ ok:false, error:"ui_key_missing" });
  const fullKey = await prisma.apiKey.findUnique({ where: { id: key.id }, include: { user: true } });
  const plan = fullKey?.user?.plan ?? fullKey?.plan ?? "free";
  return ok(res, { plan, email: fullKey?.user?.email ?? null });
});

// GET /v1/health (authed variant)
v1.get("/health", (req, res) => ok(res, { status: "ok" }));

// /v1/analyze?token=...
v1.get("/analyze", async (req, res) => {
  const token = String(req.query.token || "").trim();
  if (!token) return fail(res, 400, "token_required");
  try {
    // reuse your smart /analyze logic functionally or inline call analyzeToken
    const result = await analyzeToken(token);
    return ok(res, result);
  } catch (e: any) {
    return fail(res, 500, "analysis_failed");
  }
});

// POST /v1/debate { token, rounds? }
v1.post("/debate", async (req, res) => {
  const token = String(req.body?.token || "").trim();
  const rounds = Number(req.body?.rounds || 3);
  if (!token) return fail(res, 400, "token_required");
  try {
    const { enqueueDebate, debateEvents } = await import("./jobs/consensus/queue");
    const job = await enqueueDebate({ token, context: {} });
    const result = debateEvents ? await job.waitUntilFinished(debateEvents, 8000).catch(() => null) : null;
    return ok(res, result ?? { enqueued: true, jobId: job.id });
  } catch {
    return fail(res, 500, "debate_failed");
  }
});

// GET /v1/consensus/:token
v1.get("/consensus/:token", async (req, res) => {
  const token = String(req.params.token || "");
  const row = await (prisma as any).consensusRun.findFirst({ where: { token }, orderBy: { createdAt: "desc" } });
  if (!row) return fail(res, 404, "consensus_not_found");
  return ok(res, row);
});

// GET /v1/consensus/:token/opinions
v1.get("/consensus/:token/opinions", async (req, res) => {
  const token = String(req.params.token || "");
  const limit = Number(req.query.limit || 12);
  const rows = await (prisma as any).agentRun.findMany({
    where: { token },
    orderBy: { createdAt: "desc" },
    take: Math.max(3, Math.min(30, limit)),
  });
  return ok(res, rows.map((r: any) => ({
    id: r.id,
    agentType: r.agentType,
    output: r.outputJSON,
    createdAt: r.createdAt,
  })));
});

// POST /v1/backtest/run { limit?: number }
v1.post("/backtest/run", async (req, res) => {
  const limit = Number(req.body?.limit || 25);
  const { runOnce } = await import("./jobs/backtest/dailySignals");
  const job = await runOnce(limit);
  return ok(res, { enqueued: true, jobId: job.id, limit });
});

// GET /v1/backtest/signals?date=YYYY-MM-DD&limit=100
v1.get("/backtest/signals", async (req, res) => {
  const dateStr = String(req.query.date || "").trim();
  const limit = Number(req.query.limit || 100);
  if (!dateStr) return fail(res, 400, "date_required");
  const dayUTC = new Date(`${dateStr}T00:00:00.000Z`);
  const rows = await prisma.signalDaily.findMany({
    where: { date: dayUTC },
    orderBy: [{ score: "desc" }],
    take: Math.min(250, Math.max(1, limit)),
  });
  return ok(res, rows);
});

// GET /v1/backtest/summary?days=30
v1.get("/backtest/summary", async (req, res) => {
  const days = Number(req.query.days || 30);
  const { backtestSummary } = await import("./lib/backtest/report");
  const data = await backtestSummary(Math.max(7, Math.min(120, days)));
  return ok(res, data);
});

// GET /v1/analytics/usage?from=YYYY-MM-DD&to=YYYY-MM-DD
v1.get("/analytics/usage", async (req, res) => {
  const fromStr = String(req.query.from || "").trim();
  const toStr = String(req.query.to || "").trim();
  
  if (!fromStr || !toStr) {
    return fail(res, 400, "from_and_to_dates_required");
  }
  
  try {
    const fromDate = new Date(`${fromStr}T00:00:00.000Z`);
    const toDate = new Date(`${toStr}T23:59:59.999Z`);
    
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return fail(res, 400, "invalid_date_format");
    }
    
    const key = (req as any).apiKey;
    const rows = await (prisma as any).apiUsageDaily.findMany({
      where: {
        apiKeyId: key.id,
        date: {
          gte: fromDate,
          lte: toDate
        }
      },
      orderBy: { date: "asc" }
    });
    
    return ok(res, rows);
  } catch (error) {
    logger.error({ error }, "Analytics usage query failed");
    return fail(res, 500, "analytics_query_failed");
  }
});

// Ops metrics endpoint
v1.get("/metrics/ops", async (_req, res) => {
  const now = new Date();
  let dbOk = true;
  try { await prisma.$queryRaw`SELECT 1`; } catch { dbOk = false; }
  let redisOk = true;
  const r = getRedis();
  try { if (r) await r.ping(); } catch { redisOk = false; }

  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const y = new Date(todayUTC.getTime() - 24*3600*1000);
  const rows = await (prisma as any).apiUsageDaily.findMany({ where: { date: y } });
  const sum = rows.reduce((a: any, r: any) => {
    a.req += r.requests; a.ok += r.ok2xx;
    if (typeof r.p95LatencyMs === "number") a.p95s.push(r.p95LatencyMs);
    return a;
  }, { req: 0, ok: 0, p95s: [] as number[] });

  const okRate = sum.req ? sum.ok / sum.req : null;
  const p95 = sum.p95s.length ? sum.p95s.sort((a: number,b: number)=>a-b)[Math.floor(0.95*(sum.p95s.length-1))] : null;

  return ok(res, {
    version: APP_VERSION,
    env: env.NODE_ENV,
    time: now.toISOString(),
    dbOk, redisOk,
    slo: { okRate, p95LatencyMs: p95 },
  });
});

// WATCHLIST CRUD (per API key)
v1.get("/watchlist", async (req, res) => {
  const key = (req as any).apiKey;
  const rows = await prisma.watchItem.findMany({ where: { apiKeyId: key.id }, orderBy: { createdAt: "desc" } });
  return ok(res, rows);
});

v1.post("/watchlist", async (req, res) => {
  const key = (req as any).apiKey;
  const token = String(req.body?.token || "").trim();
  if (!token) return fail(res, 400, "token_required");
  try {
    const row = await prisma.watchItem.upsert({
      where: { apiKeyId_token: { apiKeyId: key.id, token } },
      update: {},
      create: { apiKeyId: key.id, token },
    });
    try {
      const fullKey = await prisma.apiKey.findUnique({ where: { id: key.id }, include: { user: true } });
      await audit({ userId: fullKey?.user?.id || undefined, apiKeyId: key.id, action: "watchlist.add", target: token });
    } catch {}
    return ok(res, row);
  } catch { return fail(res, 500, "watchlist_upsert_failed"); }
});

v1.delete("/watchlist/:token", async (req, res) => {
  const key = (req as any).apiKey;
  const token = String(req.params.token || "");
  await prisma.watchItem.deleteMany({ where: { apiKeyId: key.id, token } });
  try {
    const fullKey = await prisma.apiKey.findUnique({ where: { id: key.id }, include: { user: true } });
    await audit({ userId: fullKey?.user?.id || undefined, apiKeyId: key.id, action: "watchlist.remove", target: token });
  } catch {}
  return ok(res, { removed: token });
});

// ALERTS CRUD
v1.get("/alerts", async (req, res) => {
  const key = (req as any).apiKey;
  const rows = await prisma.alert.findMany({ where: { apiKeyId: key.id }, orderBy: { createdAt: "desc" } });
  return ok(res, rows);
});

v1.post("/alerts", async (req, res) => {
  const key = (req as any).apiKey;
  const token = String(req.body?.token || "").trim();
  const type = String(req.body?.type || "");
  const condition = req.body?.condition ?? {};
  const channel = String(req.body?.channel || "webhook");
  const target = String(req.body?.target || "");
  if (!token || !type || !target) return fail(res, 400, "token_type_target_required");
  const row = await prisma.alert.create({ data: { apiKeyId: key.id, token, type, condition, channel, target } });
  try {
    const fullKey = await prisma.apiKey.findUnique({ where: { id: key.id }, include: { user: true } });
    await audit({ userId: fullKey?.user?.id || undefined, apiKeyId: key.id, action: "alert.create", target: token, meta: { type, targetUrl: target } });
  } catch {}
  return ok(res, row);
});

v1.patch("/alerts/:id/toggle", async (req, res) => {
  const key = (req as any).apiKey;
  const id = Number(req.params.id);
  const a = await prisma.alert.findFirst({ where: { id, apiKeyId: key.id } });
  if (!a) return fail(res, 404, "alert_not_found");
  const row = await prisma.alert.update({ where: { id }, data: { isActive: !a.isActive } });
  try {
    const fullKey = await prisma.apiKey.findUnique({ where: { id: key.id }, include: { user: true } });
    await audit({ userId: fullKey?.user?.id || undefined, apiKeyId: key.id, action: "alert.toggle", target: String(id), meta: { active: row.isActive } });
  } catch {}
  return ok(res, row);
});

v1.delete("/alerts/:id", async (req, res) => {
  const key = (req as any).apiKey;
  const id = Number(req.params.id);
  await prisma.alert.deleteMany({ where: { id, apiKeyId: key.id } });
  try {
    const fullKey = await prisma.apiKey.findUnique({ where: { id: key.id }, include: { user: true } });
    await audit({ userId: fullKey?.user?.id || undefined, apiKeyId: key.id, action: "alert.delete", target: String(id) });
  } catch {}
  return ok(res, { removed: id });
});

// Minimal docs endpoint
v1.get("/docs", (req, res) => {
  return ok(res, {
    auth: { header: "x-api-key: <YOUR_KEY>" },
    endpoints: [
      { method: "GET", path: "/v1/health" },
      { method: "GET", path: "/v1/analyze?token=ETH" },
      { method: "POST", path: "/v1/debate", body: { token: "ETH", rounds: 3 } },
      { method: "GET", path: "/v1/consensus/:token" },
      { method: "GET", path: "/v1/consensus/:token/opinions?limit=12" },
      { method: "GET", path: "/v1/backtest/signals?date=YYYY-MM-DD&limit=100" },
      { method: "GET", path: "/v1/backtest/summary?days=30" },
      { method: "GET", path: "/v1/analytics/usage?from=YYYY-MM-DD&to=YYYY-MM-DD" },
      { method: "GET", path: "/v1/watchlist" },
      { method: "POST", path: "/v1/watchlist", body: { token: "ETH" } },
      { method: "DELETE", path: "/v1/watchlist/:token" },
      { method: "GET", path: "/v1/alerts" },
      { method: "POST", path: "/v1/alerts", body: { token: "ETH", type: "consensus_flip", condition: {}, channel: "webhook", target: "https://..." } },
      { method: "PATCH", path: "/v1/alerts/:id/toggle" },
      { method: "DELETE", path: "/v1/alerts/:id" },
    ],
    responseEnvelope: { ok: "boolean", data: "any (on success)", error: "string (on failure)" },
    rateLimits: "Per API key; see plan. 429 on exceed.",
  });
});

// --- UI Routes (same bodies as /v1) ---
ui.get("/watchlist", async (req, res) => {
  const key = (req as any).apiKey;
  const rows = await prisma.watchItem.findMany({ where: { apiKeyId: key.id }, orderBy: { createdAt: "desc" } });
  return ok(res, rows);
});
// Minimal audit logs viewer
ui.get("/audit", async (req, res) => {
  const key = (req as any).apiKey;
  const k = await prisma.apiKey.findUnique({ where: { id: key.id }, include: { user: true } });
  if (!k?.user) return res.status(500).json({ ok:false, error:"demo_user_missing" });
  const days = Number((req.query as any).days || 30);
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const rows = await (prisma as any).auditLog.findMany({
    where: { userId: k.user.id, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return ok(res, rows);
});


ui.post("/watchlist", async (req, res) => {
  const key = (req as any).apiKey;
  const token = String(req.body?.token || "").trim();
  if (!token) return fail(res, 400, "token_required");
  const row = await prisma.watchItem.upsert({
    where: { apiKeyId_token: { apiKeyId: key.id, token } },
    update: {},
    create: { apiKeyId: key.id, token },
  });
  try {
    const fullKey = await prisma.apiKey.findUnique({ where: { id: key.id }, include: { user: true } });
    await audit({ userId: fullKey?.user?.id || undefined, apiKeyId: key.id, action: "watchlist.add", target: token });
  } catch {}
  return ok(res, row);
});

ui.delete("/watchlist/:token", async (req, res) => {
  const key = (req as any).apiKey;
  const token = String(req.params.token || "");
  await prisma.watchItem.deleteMany({ where: { apiKeyId: key.id, token } });
  try {
    const fullKey = await prisma.apiKey.findUnique({ where: { id: key.id }, include: { user: true } });
    await audit({ userId: fullKey?.user?.id || undefined, apiKeyId: key.id, action: "watchlist.remove", target: token });
  } catch {}
  return ok(res, { removed: token });
});

// --- Alerts (same bodies as /v1) ---
ui.get("/alerts", async (req, res) => {
  const key = (req as any).apiKey;
  const rows = await prisma.alert.findMany({ where: { apiKeyId: key.id }, orderBy: { createdAt: "desc" } });
  return ok(res, rows);
});

ui.post("/alerts", async (req, res) => {
  const key = (req as any).apiKey;
  const token = String(req.body?.token || "").trim();
  const type = String(req.body?.type || "");
  const condition = req.body?.condition ?? {};
  const channel = String(req.body?.channel || "webhook");
  const target = String(req.body?.target || "");
  if (!token || !type || !target) return fail(res, 400, "token_type_target_required");
  const row = await prisma.alert.create({ data: { apiKeyId: key.id, token, type, condition, channel, target } });
  try {
    const fullKey = await prisma.apiKey.findUnique({ where: { id: key.id }, include: { user: true } });
    await audit({ userId: fullKey?.user?.id || undefined, apiKeyId: key.id, action: "alert.create", target: token, meta: { type, targetUrl: target } });
  } catch {}
  return ok(res, row);
});

ui.patch("/alerts/:id/toggle", async (req, res) => {
  const key = (req as any).apiKey;
  const id = Number(req.params.id);
  const a = await prisma.alert.findFirst({ where: { id, apiKeyId: key.id } });
  if (!a) return fail(res, 404, "alert_not_found");
  const row = await prisma.alert.update({ where: { id }, data: { isActive: !a.isActive } });
  try {
    const fullKey = await prisma.apiKey.findUnique({ where: { id: key.id }, include: { user: true } });
    await audit({ userId: fullKey?.user?.id || undefined, apiKeyId: key.id, action: "alert.toggle", target: String(id), meta: { active: row.isActive } });
  } catch {}
  return ok(res, row);
});

ui.delete("/alerts/:id", async (req, res) => {
  const key = (req as any).apiKey;
  const id = Number(req.params.id);
  await prisma.alert.deleteMany({ where: { id, apiKeyId: key.id } });
  try {
    const fullKey = await prisma.apiKey.findUnique({ where: { id: key.id }, include: { user: true } });
    await audit({ userId: fullKey?.user?.id || undefined, apiKeyId: key.id, action: "alert.delete", target: String(id) });
  } catch {}
  return ok(res, { removed: id });
});

// --- Portfolio endpoints ---
// Get or create demo user's single portfolio
ui.get("/portfolio", async (req, res) => {
  const key = (req as any).apiKey;
  const k = await prisma.apiKey.findUnique({ where: { id: key.id }, include: { user: true } });
  if (!k?.user) return fail(res, 500, "demo_user_missing");

  let p = await prisma.portfolio.findFirst({ where: { userId: k.user.id } });
  if (!p) {
    p = await prisma.portfolio.create({ data: { userId: k.user.id, name: "My Portfolio" } });
  }
  const holdings = await prisma.holding.findMany({ where: { portfolioId: p.id }, orderBy: { token: "asc" } });
  return ok(res, { portfolio: p, holdings });
});

// Helper function to calculate portfolio metrics
function calculatePortfolioMetrics(returns: number[]) {
  if (returns.length === 0) {
    return { cum: 0, mean: 0, stdev: 0, sharpeDaily: 0, maxDD: 0 };
  }

  // Cumulative return: product of (1 + r) - 1
  const cum = returns.reduce((acc, r) => acc * (1 + r), 1) - 1;
  
  // Mean daily return
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  
  // Standard deviation
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdev = Math.sqrt(variance);
  
  // Sharpe ratio (daily, assuming 0% risk-free rate)
  const sharpeDaily = stdev > 0 ? mean / stdev : 0;
  
  // Maximum drawdown
  let maxDD = 0;
  let peak = 1;
  let runningValue = 1;
  
  for (const r of returns) {
    runningValue *= (1 + r);
    if (runningValue > peak) {
      peak = runningValue;
    }
    const drawdown = (peak - runningValue) / peak;
    if (drawdown > maxDD) {
      maxDD = drawdown;
    }
  }

  return {
    cum: Number(cum.toFixed(4)),
    mean: Number(mean.toFixed(4)),
    stdev: Number(stdev.toFixed(4)),
    sharpeDaily: Number(sharpeDaily.toFixed(4)),
    maxDD: Number(maxDD.toFixed(4))
  };
}

// Shared function to calculate portfolio PnL data
async function getPortfolioPnlData(userId: number, days: number) {
  // Get user's portfolio and holdings
  let portfolio = await prisma.portfolio.findFirst({ where: { userId } });
  if (!portfolio) {
    portfolio = await prisma.portfolio.create({ data: { userId, name: "My Portfolio" } });
  }
  
  const holdings = await prisma.holding.findMany({ where: { portfolioId: portfolio.id } });
  
  if (holdings.length === 0) {
    return {
      windowDays: days,
      dates: [],
      portfolio: [],
      btc: [],
      eth: [],
      summary: {
        cum: 0,
        mean: 0,
        stdev: 0,
        sharpeDaily: 0,
        maxDD: 0,
        alphaBTC: 0,
        betaBTC: 0,
        alphaETH: 0,
        betaETH: 0
      }
    };
  }

  // Get tokens from holdings
  const tokens = holdings.map(h => h.token);
  
  // Import and use the price history provider
  const { getPriceHistory } = await import("./providers/prices/history");
  const priceData = await getPriceHistory({ tokens, days });
  
  if (!priceData) {
    throw new Error("failed_to_fetch_price_data");
  }

  const { dates, closes, benchmarks } = priceData;
  
  if (dates.length < 2) {
    throw new Error("insufficient_price_data");
  }

  // Calculate daily returns for portfolio
  const portfolioReturns: number[] = [];
  const btcReturns: number[] = [];
  const ethReturns: number[] = [];

  for (let i = 1; i < dates.length; i++) {
    // Portfolio return: weighted sum of token returns
    let portfolioReturn = 0;
    let totalWeight = 0;
    
    for (const holding of holdings) {
      const tokenCloses = closes[holding.token];
      if (tokenCloses && tokenCloses.length > i) {
        const prevPrice = tokenCloses[i - 1];
        const currPrice = tokenCloses[i];
        if (prevPrice !== undefined && currPrice !== undefined && prevPrice > 0 && currPrice > 0) {
          const tokenReturn = (currPrice / prevPrice) - 1;
          portfolioReturn += holding.weight * tokenReturn;
          totalWeight += holding.weight;
        }
      }
    }
    
    // Normalize by total weight if not 1.0
    if (totalWeight > 0) {
      portfolioReturn = portfolioReturn / totalWeight;
    }
    
    portfolioReturns.push(portfolioReturn);

    // BTC and ETH returns
    if (benchmarks.btc.length > i && benchmarks.btc.length > i - 1) {
      const btcPrev = benchmarks.btc[i - 1];
      const btcCurr = benchmarks.btc[i];
      if (btcPrev !== undefined && btcCurr !== undefined) {
        btcReturns.push(btcPrev > 0 ? (btcCurr / btcPrev) - 1 : 0);
      } else {
        btcReturns.push(0);
      }
    } else {
      btcReturns.push(0);
    }

    if (benchmarks.eth.length > i && benchmarks.eth.length > i - 1) {
      const ethPrev = benchmarks.eth[i - 1];
      const ethCurr = benchmarks.eth[i];
      if (ethPrev !== undefined && ethCurr !== undefined) {
        ethReturns.push(ethPrev > 0 ? (ethCurr / ethPrev) - 1 : 0);
      } else {
        ethReturns.push(0);
      }
    } else {
      ethReturns.push(0);
    }
  }

  // Calculate summary metrics
  const summary = calculatePortfolioMetrics(portfolioReturns);
  
  // Calculate alpha/beta vs benchmarks
  const { alpha: alphaBTC, beta: betaBTC } = ols(btcReturns, portfolioReturns);
  const { alpha: alphaETH, beta: betaETH } = ols(ethReturns, portfolioReturns);
  
     // Add alpha/beta to summary
   const summaryWithAlphaBeta = {
     ...summary,
     alphaBTC: Number(alphaBTC.toFixed(6)),
     betaBTC: Number(betaBTC.toFixed(4)),
     alphaETH: Number(alphaETH.toFixed(6)),
     betaETH: Number(betaETH.toFixed(4))
   };

  return {
    windowDays: days,
    dates: dates.slice(1), // Skip first date since we need 2 points for returns
    portfolio: portfolioReturns,
    btc: btcReturns,
    eth: ethReturns,
    summary: summaryWithAlphaBeta
  };
}

// GET /ui/portfolio/pnl?days=30 - Portfolio performance vs benchmarks
ui.get("/portfolio/pnl", async (req, res) => {
  try {
    const days = Math.max(7, Math.min(365, Number(req.query.days || 30)));
    
    const key = (req as any).apiKey;
    const k = await prisma.apiKey.findUnique({ where: { id: key.id }, include: { user: true } });
    if (!k?.user) return fail(res, 500, "demo_user_missing");

    // Check Redis cache first
    const r = getRedis();
    const cacheKey = `pnl:${k.user.id}:${days}`;
    if (r) {
      const hit = await r.get(cacheKey);
      if (hit) {
        return res.json(JSON.parse(hit));
      }
    }

    const result = await getPortfolioPnlData(k.user.id, days);

    // Cache the result for 10 minutes
    if (r) {
      await r.setex(cacheKey, 600, JSON.stringify(result));
    }

    return ok(res, result);

  } catch (error) {
    console.error('Portfolio PnL error:', error);
    return fail(res, 500, "portfolio_pnl_calculation_failed");
  }
});

// GET /ui/portfolio/pnl.csv?days=30 - CSV export of portfolio performance
ui.get("/portfolio/pnl.csv", async (req, res) => {
  try {
    const days = Math.max(7, Math.min(365, Number(req.query.days || 30)));
    
    const key = (req as any).apiKey;
    const k = await prisma.apiKey.findUnique({ where: { id: key.id }, include: { user: true } });
    if (!k?.user) return fail(res, 500, "demo_user_missing");

    const data = await getPortfolioPnlData(k.user.id, days);
    
    if (data.dates.length === 0) {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="chainlit-portfolio-${days}d.csv"`);
      return res.send("date,portfolio,btc,eth\n");
    }

    // Generate CSV
    let csv = "date,portfolio,btc,eth\n";
    for (let i = 0; i < data.dates.length; i++) {
      const date = data.dates[i];
      const portfolioReturn = data.portfolio[i] ?? "";
      const btcReturn = data.btc[i] ?? "";
      const ethReturn = data.eth[i] ?? "";
      csv += `${date},${portfolioReturn},${btcReturn},${ethReturn}\n`;
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="chainlit-portfolio-${days}d.csv"`);
    res.send(csv);

  } catch (error) {
    console.error('Portfolio CSV export error:', error);
    return fail(res, 500, "csv_export_failed");
  }
});

// Upsert holding (add or update weight)
ui.post("/portfolio/holdings", async (req, res) => {
  const token = String(req.body?.token || "").trim().toUpperCase();
  const weight = Number(req.body?.weight);
  if (!token || !Number.isFinite(weight) || weight < 0 || weight > 1) return fail(res, 400, "token_and_weight_required");

  const key = (req as any).apiKey;
  const k = await prisma.apiKey.findUnique({ where: { id: key.id }, include: { user: true } });
  if (!k?.user) return fail(res, 500, "demo_user_missing");

  let p = await prisma.portfolio.findFirst({ where: { userId: k.user.id } });
  if (!p) p = await prisma.portfolio.create({ data: { userId: k.user.id, name: "My Portfolio" } });

  const row = await prisma.holding.upsert({
    where: { portfolioId_token: { portfolioId: p.id, token } },
    update: { weight },
    create: { portfolioId: p.id, token, weight },
  });
  return ok(res, row);
});

// Remove holding
ui.delete("/portfolio/holdings/:token", async (req, res) => {
  const token = String(req.params.token || "").toUpperCase();
  const key = (req as any).apiKey;
  const k = await prisma.apiKey.findUnique({ where: { id: key.id }, include: { user: true } });
  if (!k?.user) return fail(res, 500, "demo_user_missing");
  const p = await prisma.portfolio.findFirst({ where: { userId: k.user.id } });
  if (!p) return ok(res, { removed: 0 });

  const r = await prisma.holding.deleteMany({ where: { portfolioId: p.id, token } });
  return ok(res, { removed: r.count });
});

// GET /ui/analytics/usage?days=30
ui.get("/analytics/usage", async (req, res) => {
  try {
    const days = Math.max(7, Math.min(365, Number(req.query.days || 30)));
    const key = (req as any).apiKey;
    
    // Calculate date range
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    
    const rows = await prisma.apiUsageDaily.findMany({
      where: {
        apiKeyId: key.id,
        date: {
          gte: fromDate,
          lte: toDate
        }
      },
      orderBy: { date: "asc" }
    });
    
    return ok(res, rows);
  } catch (error) {
    logger.error({ error }, "UI analytics usage query failed");
    return fail(res, 500, "analytics_query_failed");
  }
});

// GET /ui/analytics/usage.csv?days=30
ui.get("/analytics/usage.csv", async (req, res) => {
  try {
    const days = Math.max(7, Math.min(365, Number(req.query.days || 30)));
    const key = (req as any).apiKey;
    
    // Calculate date range
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    
    const rows = await prisma.apiUsageDaily.findMany({
      where: {
        apiKeyId: key.id,
        date: {
          gte: fromDate,
          lte: toDate
        }
      },
      orderBy: { date: "asc" }
    });

    let csv = "date,requests,ok2xx,client4xx,server5xx,avgLatencyMs,p95LatencyMs\n";
    for (const r of rows) {
      csv += `${r.date.toISOString().slice(0,10)},${r.requests},${r.ok2xx},${r.client4xx},${r.server5xx},${r.avgLatencyMs ?? ""},${r.p95LatencyMs ?? ""}\n`;
    }
    
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="chainlit-usage-${days}d.csv"`);
    res.send(csv);
  } catch (error) {
    logger.error({ error }, "UI analytics CSV export failed");
    return fail(res, 500, "csv_export_failed");
  }
});

// mount under /ui
app.use("/ui", ui);

// mount under /v1
app.use("/v1", v1);

// (webhook mounted above)

// Sentry error handler AFTER routes (only if Sentry is available)
// TODO: Fix Sentry v10+ integration
// if (process.env.SENTRY_DSN) {
//   app.use(Sentry.errorHandler() as ErrorRequestHandler);
// }

// Final error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "unhandled error");
  const message = (err && typeof err === "object" && "message" in err) ? (err as any).message : "Internal Server Error";
  res.status(500).json({ error: "internal_error", message });
 });

// Process-level guards
process.on("unhandledRejection", (reason) => logger.error({ reason }, "unhandledRejection"));
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaughtException");
  // optional: process.exit(1);
});

app.listen(port, () => {
  logger.info(`Listening on port ${port}`);
  
  // Temporarily disabled for debugging
  // Initialize backtest scheduler and worker
  // scheduleDaily(100).catch((err) => {
  //   logger.warn({ err }, "Failed to schedule daily backtest job");
  // });
  
  // Initialize alert evaluator scheduler
  // scheduleAlertEvaluator().catch((err) => {
  //   logger.warn({ err }, "Failed to schedule alert evaluator job");
  // });
  
  // Initialize analytics rollup scheduler
  import("./jobs/analytics/rollup").then(({ scheduleDailyRollup }) => {
    scheduleDailyRollup().catch((err) => {
      logger.warn({ err }, "Failed to schedule analytics rollup job");
    });
  }).catch((err) => {
    logger.warn({ err }, "Failed to import analytics rollup module");
  });
  
  // logger.info("Backtest worker started and listening for jobs");
  // logger.info("Alert evaluator started and scheduled every 5 minutes");
});
