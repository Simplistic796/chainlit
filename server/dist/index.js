"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const zod_1 = require("zod");
const prisma_1 = require("./db/prisma");
const scoring_1 = require("./lib/scoring/scoring");
const queue_1 = require("./jobs/queue");
const redis_1 = require("./cache/redis");
const queue_2 = require("./jobs/consensus/queue");
const logger_1 = require("./observability/logger");
const sentry_1 = require("./observability/sentry");
const pino_http_1 = __importDefault(require("pino-http"));
const uuid_1 = require("uuid");
const mw_1 = require("./api/mw");
const uiKey_1 = require("./api/uiKey");
const dailySignals_1 = require("./jobs/backtest/dailySignals");
const evaluator_1 = require("./jobs/alerts/evaluator");
const app = (0, express_1.default)();
const port = Number(process.env.PORT || 3000);
// Initialize Sentry + logging
(0, sentry_1.initSentry)();
// Sentry request/tracing handlers FIRST (only if Sentry is available)
// TODO: Fix Sentry v10+ integration
// if (process.env.SENTRY_DSN) {
//   app.use(Sentry.requestHandler());
//   app.use(Sentry.tracingHandler());
// }
// Request ID + pino logger
app.use((req, _res, next) => {
    req.id = req.headers["x-request-id"] ?? (0, uuid_1.v4)();
    next();
});
app.use((0, pino_http_1.default)({
    logger: logger_1.logger,
    customProps: (req) => ({ reqId: req.id }),
}));
app.use((0, cors_1.default)());
app.use((0, helmet_1.default)());
app.set("trust proxy", 1);
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(apiLimiter);
app.use(express_1.default.json());
app.get("/health", (req, res) => {
    res.send("Server is running 🚀");
});
// Schema to validate query ?token=...
const AnalyzeQuery = zod_1.z.object({
    token: zod_1.z.string().min(1, "token is required"),
});
// GET /analyze?token=ETH
app.get("/analyze", async (req, res) => {
    const token = String(req.query.token || "").trim();
    if (!token)
        return res.status(400).json({ error: "token is required" });
    const key = `analysis:${token.toLowerCase()}`;
    // 1) Serve from cache if hot
    try {
        const cached = await (0, redis_1.cacheGetJSON)(key);
        if (cached)
            return res.json(cached);
    }
    catch { }
    // 2) If Redis is available, enqueue a job and wait briefly for it to finish
    try {
        const r = (0, redis_1.getRedis)();
        if (r && queue_1.analyzeEvents) {
            const job = await (0, queue_1.enqueueAnalyze)(token);
            const result = await job.waitUntilFinished(queue_1.analyzeEvents, 8000).catch(() => null);
            if (result)
                return res.json(result);
            const after = await (0, redis_1.cacheGetJSON)(key);
            if (after)
                return res.json(after);
        }
    }
    catch (e) {
        logger_1.logger.warn({ err: e }, "Job path failed, falling back inline");
    }
    // 3) Fallback: run inline
    try {
        const result = await (0, scoring_1.analyzeToken)(token);
        return res.json(result);
    }
    catch (e) {
        logger_1.logger.error({ err: e }, "Inline analyze failed");
        return res.status(500).json({ error: "analysis failed" });
    }
});
// GET /recent -> last 3 lookups
app.get("/recent", async (_req, res) => {
    const rows = await prisma_1.prisma.tokenLookup.findMany({
        take: 3,
        orderBy: { createdAt: "desc" },
    });
    return res.json(rows);
});
// POST /jobs/analyze { token }
app.post("/jobs/analyze", async (req, res) => {
    const token = String(req.body?.token || "").trim();
    if (!token)
        return res.status(400).json({ error: "token is required" });
    try {
        const job = await (0, queue_1.enqueueAnalyze)(token);
        return res.json({ jobId: job.id });
    }
    catch (e) {
        logger_1.logger.error({ err: e }, "enqueue error");
        return res.status(500).json({ error: "failed to enqueue" });
    }
});
const DebateRequest = zod_1.z.object({ token: zod_1.z.string().min(1), rounds: zod_1.z.number().int().min(1).max(5).optional() });
// start debate
app.post("/debate", async (req, res) => {
    const parsed = DebateRequest.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const job = await (0, queue_2.enqueueDebate)({ token: parsed.data.token, context: {} }, { attempts: 1 });
    return res.json({ jobId: job.id });
});
// fetch last consensus for a token
app.get("/consensus/:token", async (req, res) => {
    const token = String(req.params.token);
    const row = await prisma_1.prisma.consensusRun.findFirst({
        where: { token },
        orderBy: { createdAt: "desc" },
    });
    if (!row)
        return res.status(404).json({ error: "No consensus yet" });
    return res.json(row);
});
// Get recent agent opinions for a token (last 12 by default)
app.get("/consensus/:token/opinions", async (req, res) => {
    const token = String(req.params.token).trim();
    const limit = Number(req.query.limit ?? 12);
    const rows = await prisma_1.prisma.agentRun.findMany({
        where: { token },
        orderBy: { createdAt: "desc" },
        take: Math.max(3, Math.min(30, limit)),
    });
    // Map to a clean shape
    const opinions = rows.map((r) => ({
        id: r.id,
        agentType: r.agentType,
        output: r.outputJSON, // { agent, stance, confidence, rationale, features }
        createdAt: r.createdAt,
    }));
    res.json({ token, opinions });
});
// V1 API Routes (secured with API keys)
const v1 = express_1.default.Router();
// secure all v1 endpoints
v1.use(mw_1.apiAuth, mw_1.logApiUsage);
// UI Routes (server-owned, no auth header needed)
const ui = express_1.default.Router();
// attach the demo ApiKey object to req (like apiAuth would do)
ui.use(async (req, res, next) => {
    try {
        req.apiKey = await (0, uiKey_1.getUiApiKey)();
        next();
    }
    catch (e) {
        console.error("UI key error:", e);
        return res.status(500).json({ ok: false, error: "ui_key_missing" });
    }
});
// Optional: record usage for analytics
ui.use(mw_1.logApiUsage);
// GET /v1/health (authed variant)
v1.get("/health", (req, res) => (0, mw_1.ok)(res, { status: "ok" }));
// /v1/analyze?token=...
v1.get("/analyze", async (req, res) => {
    const token = String(req.query.token || "").trim();
    if (!token)
        return (0, mw_1.fail)(res, 400, "token_required");
    try {
        // reuse your smart /analyze logic functionally or inline call analyzeToken
        const result = await (0, scoring_1.analyzeToken)(token);
        return (0, mw_1.ok)(res, result);
    }
    catch (e) {
        return (0, mw_1.fail)(res, 500, "analysis_failed");
    }
});
// POST /v1/debate { token, rounds? }
v1.post("/debate", async (req, res) => {
    const token = String(req.body?.token || "").trim();
    const rounds = Number(req.body?.rounds || 3);
    if (!token)
        return (0, mw_1.fail)(res, 400, "token_required");
    try {
        const { enqueueDebate, debateEvents } = await Promise.resolve().then(() => __importStar(require("./jobs/consensus/queue")));
        const job = await enqueueDebate({ token, context: {} });
        const result = debateEvents ? await job.waitUntilFinished(debateEvents, 8000).catch(() => null) : null;
        return (0, mw_1.ok)(res, result ?? { enqueued: true, jobId: job.id });
    }
    catch {
        return (0, mw_1.fail)(res, 500, "debate_failed");
    }
});
// GET /v1/consensus/:token
v1.get("/consensus/:token", async (req, res) => {
    const token = String(req.params.token || "");
    const row = await prisma_1.prisma.consensusRun.findFirst({ where: { token }, orderBy: { createdAt: "desc" } });
    if (!row)
        return (0, mw_1.fail)(res, 404, "consensus_not_found");
    return (0, mw_1.ok)(res, row);
});
// GET /v1/consensus/:token/opinions
v1.get("/consensus/:token/opinions", async (req, res) => {
    const token = String(req.params.token || "");
    const limit = Number(req.query.limit || 12);
    const rows = await prisma_1.prisma.agentRun.findMany({
        where: { token },
        orderBy: { createdAt: "desc" },
        take: Math.max(3, Math.min(30, limit)),
    });
    return (0, mw_1.ok)(res, rows.map((r) => ({
        id: r.id,
        agentType: r.agentType,
        output: r.outputJSON,
        createdAt: r.createdAt,
    })));
});
// POST /v1/backtest/run { limit?: number }
v1.post("/backtest/run", async (req, res) => {
    const limit = Number(req.body?.limit || 25);
    const { runOnce } = await Promise.resolve().then(() => __importStar(require("./jobs/backtest/dailySignals")));
    const job = await runOnce(limit);
    return (0, mw_1.ok)(res, { enqueued: true, jobId: job.id, limit });
});
// GET /v1/backtest/signals?date=YYYY-MM-DD&limit=100
v1.get("/backtest/signals", async (req, res) => {
    const dateStr = String(req.query.date || "").trim();
    const limit = Number(req.query.limit || 100);
    if (!dateStr)
        return (0, mw_1.fail)(res, 400, "date_required");
    const dayUTC = new Date(`${dateStr}T00:00:00.000Z`);
    const rows = await prisma_1.prisma.signalDaily.findMany({
        where: { date: dayUTC },
        orderBy: [{ score: "desc" }],
        take: Math.min(250, Math.max(1, limit)),
    });
    return (0, mw_1.ok)(res, rows);
});
// GET /v1/backtest/summary?days=30
v1.get("/backtest/summary", async (req, res) => {
    const days = Number(req.query.days || 30);
    const { backtestSummary } = await Promise.resolve().then(() => __importStar(require("./lib/backtest/report")));
    const data = await backtestSummary(Math.max(7, Math.min(120, days)));
    return (0, mw_1.ok)(res, data);
});
// WATCHLIST CRUD (per API key)
v1.get("/watchlist", async (req, res) => {
    const key = req.apiKey;
    const rows = await prisma_1.prisma.watchItem.findMany({ where: { apiKeyId: key.id }, orderBy: { createdAt: "desc" } });
    return (0, mw_1.ok)(res, rows);
});
v1.post("/watchlist", async (req, res) => {
    const key = req.apiKey;
    const token = String(req.body?.token || "").trim();
    if (!token)
        return (0, mw_1.fail)(res, 400, "token_required");
    try {
        const row = await prisma_1.prisma.watchItem.upsert({
            where: { apiKeyId_token: { apiKeyId: key.id, token } },
            update: {},
            create: { apiKeyId: key.id, token },
        });
        return (0, mw_1.ok)(res, row);
    }
    catch {
        return (0, mw_1.fail)(res, 500, "watchlist_upsert_failed");
    }
});
v1.delete("/watchlist/:token", async (req, res) => {
    const key = req.apiKey;
    const token = String(req.params.token || "");
    await prisma_1.prisma.watchItem.deleteMany({ where: { apiKeyId: key.id, token } });
    return (0, mw_1.ok)(res, { removed: token });
});
// ALERTS CRUD
v1.get("/alerts", async (req, res) => {
    const key = req.apiKey;
    const rows = await prisma_1.prisma.alert.findMany({ where: { apiKeyId: key.id }, orderBy: { createdAt: "desc" } });
    return (0, mw_1.ok)(res, rows);
});
v1.post("/alerts", async (req, res) => {
    const key = req.apiKey;
    const token = String(req.body?.token || "").trim();
    const type = String(req.body?.type || "");
    const condition = req.body?.condition ?? {};
    const channel = String(req.body?.channel || "webhook");
    const target = String(req.body?.target || "");
    if (!token || !type || !target)
        return (0, mw_1.fail)(res, 400, "token_type_target_required");
    const row = await prisma_1.prisma.alert.create({ data: { apiKeyId: key.id, token, type, condition, channel, target } });
    return (0, mw_1.ok)(res, row);
});
v1.patch("/alerts/:id/toggle", async (req, res) => {
    const key = req.apiKey;
    const id = Number(req.params.id);
    const a = await prisma_1.prisma.alert.findFirst({ where: { id, apiKeyId: key.id } });
    if (!a)
        return (0, mw_1.fail)(res, 404, "alert_not_found");
    const row = await prisma_1.prisma.alert.update({ where: { id }, data: { isActive: !a.isActive } });
    return (0, mw_1.ok)(res, row);
});
v1.delete("/alerts/:id", async (req, res) => {
    const key = req.apiKey;
    const id = Number(req.params.id);
    await prisma_1.prisma.alert.deleteMany({ where: { id, apiKeyId: key.id } });
    return (0, mw_1.ok)(res, { removed: id });
});
// Minimal docs endpoint
v1.get("/docs", (req, res) => {
    return (0, mw_1.ok)(res, {
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
    const key = req.apiKey;
    const rows = await prisma_1.prisma.watchItem.findMany({ where: { apiKeyId: key.id }, orderBy: { createdAt: "desc" } });
    return (0, mw_1.ok)(res, rows);
});
ui.post("/watchlist", async (req, res) => {
    const key = req.apiKey;
    const token = String(req.body?.token || "").trim();
    if (!token)
        return (0, mw_1.fail)(res, 400, "token_required");
    const row = await prisma_1.prisma.watchItem.upsert({
        where: { apiKeyId_token: { apiKeyId: key.id, token } },
        update: {},
        create: { apiKeyId: key.id, token },
    });
    return (0, mw_1.ok)(res, row);
});
ui.delete("/watchlist/:token", async (req, res) => {
    const key = req.apiKey;
    const token = String(req.params.token || "");
    await prisma_1.prisma.watchItem.deleteMany({ where: { apiKeyId: key.id, token } });
    return (0, mw_1.ok)(res, { removed: token });
});
// --- Alerts (same bodies as /v1) ---
ui.get("/alerts", async (req, res) => {
    const key = req.apiKey;
    const rows = await prisma_1.prisma.alert.findMany({ where: { apiKeyId: key.id }, orderBy: { createdAt: "desc" } });
    return (0, mw_1.ok)(res, rows);
});
ui.post("/alerts", async (req, res) => {
    const key = req.apiKey;
    const token = String(req.body?.token || "").trim();
    const type = String(req.body?.type || "");
    const condition = req.body?.condition ?? {};
    const channel = String(req.body?.channel || "webhook");
    const target = String(req.body?.target || "");
    if (!token || !type || !target)
        return (0, mw_1.fail)(res, 400, "token_type_target_required");
    const row = await prisma_1.prisma.alert.create({ data: { apiKeyId: key.id, token, type, condition, channel, target } });
    return (0, mw_1.ok)(res, row);
});
ui.patch("/alerts/:id/toggle", async (req, res) => {
    const key = req.apiKey;
    const id = Number(req.params.id);
    const a = await prisma_1.prisma.alert.findFirst({ where: { id, apiKeyId: key.id } });
    if (!a)
        return (0, mw_1.fail)(res, 404, "alert_not_found");
    const row = await prisma_1.prisma.alert.update({ where: { id }, data: { isActive: !a.isActive } });
    return (0, mw_1.ok)(res, row);
});
ui.delete("/alerts/:id", async (req, res) => {
    const key = req.apiKey;
    const id = Number(req.params.id);
    await prisma_1.prisma.alert.deleteMany({ where: { id, apiKeyId: key.id } });
    return (0, mw_1.ok)(res, { removed: id });
});
// mount under /ui
app.use("/ui", ui);
// mount under /v1
app.use("/v1", v1);
// Sentry error handler AFTER routes (only if Sentry is available)
// TODO: Fix Sentry v10+ integration
// if (process.env.SENTRY_DSN) {
//   app.use(Sentry.errorHandler() as ErrorRequestHandler);
// }
// Final error handler
app.use((err, _req, res, _next) => {
    logger_1.logger.error({ err }, "unhandled error");
    res.status(500).json({ error: "internal_error" });
});
// Process-level guards
process.on("unhandledRejection", (reason) => logger_1.logger.error({ reason }, "unhandledRejection"));
process.on("uncaughtException", (err) => {
    logger_1.logger.fatal({ err }, "uncaughtException");
    // optional: process.exit(1);
});
app.listen(port, () => {
    logger_1.logger.info(`Listening on port ${port}`);
    // Initialize backtest scheduler and worker
    (0, dailySignals_1.scheduleDaily)(100).catch((err) => {
        logger_1.logger.warn({ err }, "Failed to schedule daily backtest job");
    });
    // Initialize alert evaluator scheduler
    (0, evaluator_1.scheduleAlertEvaluator)().catch((err) => {
        logger_1.logger.warn({ err }, "Failed to schedule alert evaluator job");
    });
    logger_1.logger.info("Backtest worker started and listening for jobs");
    logger_1.logger.info("Alert evaluator started and scheduled every 5 minutes");
});
//# sourceMappingURL=index.js.map