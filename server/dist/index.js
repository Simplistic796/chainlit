"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const zod_1 = require("zod");
const prisma_1 = require("./db/prisma");
const scoring_1 = require("./lib/scoring/scoring");
const queue_1 = require("./jobs/queue");
const app = (0, express_1.default)();
const port = 3000;
app.use((0, cors_1.default)());
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
    const parsed = AnalyzeQuery.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const token = String(parsed.data.token).trim();
    // Use new scoring engine (async)
    const result = await (0, scoring_1.analyzeToken)(token);
    // Save to DB (recent searches)
    try {
        await prisma_1.prisma.tokenLookup.create({
            data: {
                token: result.token,
                score: result.score,
                risk: result.risk,
                outlook: result.outlook,
            },
        });
    }
    catch (e) {
        // non-fatal for MVP; log and continue
        console.error("DB save error:", e);
    }
    return res.json(result);
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
app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
//# sourceMappingURL=index.js.map