import { Queue, Worker, JobsOptions } from "bullmq";
import { getRedisForBullMQ } from "../../cache/redis";
import { prisma } from "../../db/prisma";
import { analyzeToken } from "../../lib/scoring/scoring";
import { debateRoundRobin } from "../../agents/consensus/roundRobin";
import { AgentInput } from "../../agents/shared/types";
import { getTopSymbols } from "../../providers/coingecko/universe";

const connection = getRedisForBullMQ();

export type DailyJobData = { limit: number };

export const dailyQueue = new Queue<DailyJobData>("backtest.daily", { connection: connection as any });

export const dailyWorker = new Worker<DailyJobData>(
  "backtest.daily",
  async (job) => {
    const limit = job.data.limit ?? 100;
    const universe = await getTopSymbols(limit);
    const today = new Date();
    const dayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    for (const u of universe) {
      const input: AgentInput = { token: u.symbol, context: {} };
      // Use your debate to get decision+confidence; analysis gives score/risk/outlook
      const analysis = await analyzeToken(u.symbol);
      const debate = await debateRoundRobin(input, { rounds: 3, quorum: 0.5 });

      await prisma.signalDaily.upsert({
        where: { date_token: { date: dayUTC, token: analysis.token } },
        update: {
          score: analysis.score,
          risk: analysis.risk,
          outlook: analysis.outlook,
          decision: debate.decision,
          confidence: debate.confidence,
          priceUsd: u.price,
        },
        create: {
          date: dayUTC,
          token: analysis.token,
          score: analysis.score,
          risk: analysis.risk,
          outlook: analysis.outlook,
          decision: debate.decision,
          confidence: debate.confidence,
          priceUsd: u.price,
        },
      });
    }

    return { count: universe.length, date: dayUTC.toISOString() };
  },
  { connection: connection as any, concurrency: 1 }
);

export async function scheduleDaily(limit = 100) {
  // 05:10 UTC every day (stagger away from CG rate limits)
  await dailyQueue.add(
    "collect",
    { limit },
    { repeat: { pattern: "10 5 * * *", tz: "UTC" }, removeOnComplete: 50, removeOnFail: 50 }
  );
}

export async function runOnce(limit = 25, opts?: JobsOptions) {
  return dailyQueue.add("collect-once", { limit }, { removeOnComplete: 50, removeOnFail: 50, ...(opts || {}) });
}
