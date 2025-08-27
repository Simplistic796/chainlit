// src/jobs/queue.ts
import { Queue, QueueEvents, Worker, JobsOptions } from "bullmq";
import { prisma } from "../db/prisma";
import { getRedisForBullMQ, cacheSetJSON } from "../cache/redis";
import { analyzeToken } from "../lib/scoring/scoring";

// Multi-Agent Queue Names (to be implemented):
// queue:sentiment.analyze
// queue:valuation.analyze  
// queue:risk.analyze
// queue:consensus.debate

const connection = getRedisForBullMQ();
export type AnalyzeJobData = { token: string };

export const analyzeQueue = connection ? new Queue<AnalyzeJobData>("analyze", { connection: connection as any }) : null as unknown as Queue<AnalyzeJobData>;
export const analyzeEvents = connection ? new QueueEvents("analyze", { connection: connection as any }) : null as unknown as QueueEvents;

export const analyzeWorker = connection
  ? new Worker<AnalyzeJobData>(
      "analyze",
      async (job) => {
        const { token } = job.data;

        // 1) Run full analysis (live providers + heuristics)
        const result = await analyzeToken(token);

        await prisma.tokenLookup.create({
          data: {
            token: result.token,
            score: result.score,
            risk: result.risk,
            outlook: result.outlook,
          },
        });

        // 3) Write hot cache for quick reads (TTL ~60s)
        try { await cacheSetJSON(`analysis:${token.toLowerCase()}`, result, 60); } catch {}

        return result;
      },
      { connection: connection as any, concurrency: 2 }
    )
  : (null as unknown as Worker<AnalyzeJobData>);

if (connection && analyzeWorker) {
  analyzeWorker.on("completed", (job, res) => {
    console.log(`[job completed] ${job.id} token=${job.data.token}`);
  });
  analyzeWorker.on("failed", (job, err) => {
    console.error(`[job failed] ${job?.id} ${err?.message}`);
  });
}

export async function enqueueAnalyze(token: string, opts?: JobsOptions) {
  if (!connection || !analyzeQueue) {
    throw new Error("Redis not configured for BullMQ");
  }
  return analyzeQueue.add("analyze-token", { token }, {
    removeOnComplete: 50,
    removeOnFail: 50,
    attempts: 2,
    backoff: { type: "exponential", delay: 1500 },
    ...(opts || {})
  });
}
