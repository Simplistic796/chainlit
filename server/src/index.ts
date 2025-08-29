// src/index.ts
import "dotenv/config";
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
import { cacheGetJSON, getRedis } from "./cache/redis";
import { enqueueDebate } from "./jobs/consensus/queue";
import { logger } from "./observability/logger";
import { initSentry } from "./observability/sentry";
import * as Sentry from "@sentry/node";
import pinoHttp from "pino-http";
import { v4 as uuidv4 } from "uuid";
import { apiAuth, logApiUsage, ok, fail } from "./api/mw";
import { scheduleDaily, dailyWorker } from "./jobs/backtest/dailySignals";
import { scheduleAlertEvaluator } from "./jobs/alerts/evaluator";

const app = express();
const port = Number(process.env.PORT || 3000);

// Initialize Sentry + logging
initSentry();

// Debug environment variables
console.log("Environment check:");
console.log("DEMO_API_KEY:", process.env.DEMO_API_KEY ? "SET" : "NOT SET");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "SET" : "NOT SET");

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
app.use(
  pinoHttp({
    logger,
    customProps: (req) => ({ reqId: (req as any).id }),
  })
);

app.use(cors());
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

app.use(express.json());

app.get("/health", (req: Request, res: Response) => {
  res.send("Server is running 🚀");
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
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" }) : null;

v1.post("/checkout", async (req, res) => {
  if (!stripe) return fail(res, 500, "stripe_not_configured");
  const email = String(req.body?.email || "").trim();
  if (!email) return fail(res, 400, "email_required");
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [{ price: String(process.env.STRIPE_PRICE_ID || ""), quantity: 1 }],
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
    return ok(res, row);
  } catch { return fail(res, 500, "watchlist_upsert_failed"); }
});

v1.delete("/watchlist/:token", async (req, res) => {
  const key = (req as any).apiKey;
  const token = String(req.params.token || "");
  await prisma.watchItem.deleteMany({ where: { apiKeyId: key.id, token } });
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
  return ok(res, row);
});

v1.patch("/alerts/:id/toggle", async (req, res) => {
  const key = (req as any).apiKey;
  const id = Number(req.params.id);
  const a = await prisma.alert.findFirst({ where: { id, apiKeyId: key.id } });
  if (!a) return fail(res, 404, "alert_not_found");
  const row = await prisma.alert.update({ where: { id }, data: { isActive: !a.isActive } });
  return ok(res, row);
});

v1.delete("/alerts/:id", async (req, res) => {
  const key = (req as any).apiKey;
  const id = Number(req.params.id);
  await prisma.alert.deleteMany({ where: { id, apiKeyId: key.id } });
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

ui.post("/watchlist", async (req, res) => {
  const key = (req as any).apiKey;
  const token = String(req.body?.token || "").trim();
  if (!token) return fail(res, 400, "token_required");
  const row = await prisma.watchItem.upsert({
    where: { apiKeyId_token: { apiKeyId: key.id, token } },
    update: {},
    create: { apiKeyId: key.id, token },
  });
  return ok(res, row);
});

ui.delete("/watchlist/:token", async (req, res) => {
  const key = (req as any).apiKey;
  const token = String(req.params.token || "");
  await prisma.watchItem.deleteMany({ where: { apiKeyId: key.id, token } });
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
  return ok(res, row);
});

ui.patch("/alerts/:id/toggle", async (req, res) => {
  const key = (req as any).apiKey;
  const id = Number(req.params.id);
  const a = await prisma.alert.findFirst({ where: { id, apiKeyId: key.id } });
  if (!a) return fail(res, 404, "alert_not_found");
  const row = await prisma.alert.update({ where: { id }, data: { isActive: !a.isActive } });
  return ok(res, row);
});

ui.delete("/alerts/:id", async (req, res) => {
  const key = (req as any).apiKey;
  const id = Number(req.params.id);
  await prisma.alert.deleteMany({ where: { id, apiKeyId: key.id } });
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

// GET /ui/portfolio/pnl?days=30 - Portfolio performance vs benchmarks
ui.get("/portfolio/pnl", async (req, res) => {
  try {
    const days = Math.max(7, Math.min(365, Number(req.query.days || 30)));
    
    const key = (req as any).apiKey;
    const k = await prisma.apiKey.findUnique({ where: { id: key.id }, include: { user: true } });
    if (!k?.user) return fail(res, 500, "demo_user_missing");

    // Get user's portfolio and holdings
    let portfolio = await prisma.portfolio.findFirst({ where: { userId: k.user.id } });
    if (!portfolio) {
      portfolio = await prisma.portfolio.create({ data: { userId: k.user.id, name: "My Portfolio" } });
    }
    
    const holdings = await prisma.holding.findMany({ where: { portfolioId: portfolio.id } });
    
    if (holdings.length === 0) {
      return ok(res, {
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
          maxDD: 0
        }
      });
    }

    // Get tokens from holdings
    const tokens = holdings.map(h => h.token);
    
    // Import and use the price history provider
    const { getPriceHistory } = await import("./providers/prices/history");
    const priceData = await getPriceHistory({ tokens, days });
    
    if (!priceData) {
      return fail(res, 500, "failed_to_fetch_price_data");
    }

    const { dates, closes, benchmarks } = priceData;
    
    if (dates.length < 2) {
      return fail(res, 400, "insufficient_price_data");
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

    return ok(res, {
      windowDays: days,
      dates: dates.slice(1), // Skip first date since we need 2 points for returns
      portfolio: portfolioReturns,
      btc: btcReturns,
      eth: ethReturns,
      summary
    });

  } catch (error) {
    console.error('Portfolio PnL error:', error);
    return fail(res, 500, "portfolio_pnl_calculation_failed");
  }
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
  res.status(500).json({ error: "internal_error" });
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
  
  // logger.info("Backtest worker started and listening for jobs");
  // logger.info("Alert evaluator started and scheduled every 5 minutes");
});
