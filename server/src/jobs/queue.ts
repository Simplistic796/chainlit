// src/jobs/queue.ts
import { Queue, QueueEvents, Worker, JobsOptions } from "bullmq";
import { prisma } from "../db/prisma";
import { getRedisForBullMQ } from "../cache/redis";
import { analyzeTokenMock } from "../lib/scoring/mockScoring"; // will swap with real scoring later

const connection = getRedisForBullMQ();
export type AnalyzeJobData = { token: string };

export const analyzeQueue = new Queue<AnalyzeJobData>("analyze", { connection: connection as any });
export const analyzeEvents = new QueueEvents("analyze", { connection: connection as any });

export const analyzeWorker = new Worker<AnalyzeJobData>(
  "analyze",
  async (job) => {
    const { token } = job.data;

    // TODO: replace with real data fetch & scoring
    const result = analyzeTokenMock(token);

    await prisma.tokenLookup.create({
      data: {
        token: result.token,
        score: result.score,
        risk: result.risk,
        outlook: result.outlook,
      },
    });

    return result;
  },
  { connection: connection as any, concurrency: 2 }
);

analyzeWorker.on("completed", (job, res) => {
  console.log(`[job completed] ${job.id} token=${job.data.token} score=${(res as any)?.score}`);
});
analyzeWorker.on("failed", (job, err) => {
  console.error(`[job failed] ${job?.id} ${err?.message}`);
});

export async function enqueueAnalyze(token: string, opts?: JobsOptions) {
  return analyzeQueue.add("analyze-token", { token }, { removeOnComplete: 50, removeOnFail: 50, ...(opts || {}) });
}
