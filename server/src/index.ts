// src/index.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "./db/prisma";
import { analyzeToken } from "./lib/scoring/scoring";
import { enqueueAnalyze, analyzeEvents } from "./jobs/queue";
import { cacheGetJSON, getRedis } from "./cache/redis";
import { enqueueDebate } from "./jobs/consensus/queue";

const app = express();
const port = 3000;

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

app.use(express.json());

app.get("/health", (req, res) => {
  res.send("Server is running 🚀");
});

// Schema to validate query ?token=...
const AnalyzeQuery = z.object({
  token: z.string().min(1, "token is required"),
});

// GET /analyze?token=ETH
app.get("/analyze", async (req, res) => {
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
    console.warn("Job path failed, falling back inline:", (e as Error)?.message);
  }

  // 3) Fallback: run inline
  try {
    const result = await analyzeToken(token);
    return res.json(result);
  } catch (e) {
    console.error("Inline analyze failed:", (e as Error)?.message);
    return res.status(500).json({ error: "analysis failed" });
  }
});

// GET /recent -> last 3 lookups
app.get("/recent", async (_req, res) => {
  const rows = await prisma.tokenLookup.findMany({
    take: 3,
    orderBy: { createdAt: "desc" },
  });
  return res.json(rows);
});

// POST /jobs/analyze { token }
app.post("/jobs/analyze", async (req, res) => {
  const token = String(req.body?.token || "").trim();
  if (!token) return res.status(400).json({ error: "token is required" });
  try {
    const job = await enqueueAnalyze(token);
    return res.json({ jobId: job.id });
  } catch (e: any) {
    console.error("enqueue error:", e);
    return res.status(500).json({ error: "failed to enqueue" });
  }
});

const DebateRequest = z.object({ token: z.string().min(1), rounds: z.number().int().min(1).max(5).optional() });

// start debate
app.post("/debate", async (req, res) => {
  const parsed = DebateRequest.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const job = await enqueueDebate({ token: parsed.data.token, context: {} }, { attempts: 1 });
  return res.json({ jobId: job.id });
});

// fetch last consensus for a token
app.get("/consensus/:token", async (req, res) => {
  const token = String(req.params.token);
  const row = await prisma.consensusRun.findFirst({
    where: { token },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return res.status(404).json({ error: "No consensus yet" });
  return res.json(row);
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
