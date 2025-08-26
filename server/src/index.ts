// src/index.ts
import express from "express";
import cors from "cors";
import { z } from "zod";
import { prisma } from "./db/prisma";
import { analyzeToken } from "./lib/scoring/scoring";
import { enqueueAnalyze } from "./jobs/queue";

const app = express();
const port = 3000;

app.use(cors());
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
  const parsed = AnalyzeQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const token = String(parsed.data.token).trim();

  // Use new scoring engine (async)
  const result = await analyzeToken(token);

  // Save to DB (recent searches)
  try {
    await prisma.tokenLookup.create({
      data: {
        token: result.token,
        score: result.score,
        risk: result.risk,
        outlook: result.outlook,
      },
    });
  } catch (e) {
    // non-fatal for MVP; log and continue
    console.error("DB save error:", e);
  }

  return res.json(result);
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

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
