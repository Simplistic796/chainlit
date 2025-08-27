"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
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
const app = (0, express_1.default)();
const port = Number(process.env.PORT || 3000);
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
        console.warn("Job path failed, falling back inline:", e?.message);
    }
    // 3) Fallback: run inline
    try {
        const result = await (0, scoring_1.analyzeToken)(token);
        return res.json(result);
    }
    catch (e) {
        console.error("Inline analyze failed:", e?.message);
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
        console.error("enqueue error:", e);
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
app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
//# sourceMappingURL=index.js.map