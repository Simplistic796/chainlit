"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyWorker = exports.dailyQueue = void 0;
exports.scheduleDaily = scheduleDaily;
exports.runOnce = runOnce;
const bullmq_1 = require("bullmq");
const redis_1 = require("../../cache/redis");
const prisma_1 = require("../../db/prisma");
const scoring_1 = require("../../lib/scoring/scoring");
const roundRobin_1 = require("../../agents/consensus/roundRobin");
const universe_1 = require("../../providers/coingecko/universe");
const connection = (0, redis_1.getRedisForBullMQ)();
exports.dailyQueue = new bullmq_1.Queue("backtest.daily", { connection: connection });
exports.dailyWorker = new bullmq_1.Worker("backtest.daily", async (job) => {
    const limit = job.data.limit ?? 100;
    const universe = await (0, universe_1.getTopSymbols)(limit);
    const today = new Date();
    const dayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    for (const u of universe) {
        const input = { token: u.symbol, context: {} };
        // Use your debate to get decision+confidence; analysis gives score/risk/outlook
        const analysis = await (0, scoring_1.analyzeToken)(u.symbol);
        const debate = await (0, roundRobin_1.debateRoundRobin)(input, { rounds: 3, quorum: 0.5 });
        await prisma_1.prisma.signalDaily.upsert({
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
}, { connection: connection, concurrency: 1 });
async function scheduleDaily(limit = 100) {
    // 05:10 UTC every day (stagger away from CG rate limits)
    await exports.dailyQueue.add("collect", { limit }, { repeat: { pattern: "10 5 * * *", tz: "UTC" }, removeOnComplete: 50, removeOnFail: 50 });
}
async function runOnce(limit = 25, opts) {
    return exports.dailyQueue.add("collect-once", { limit }, { removeOnComplete: 50, removeOnFail: 50, ...(opts || {}) });
}
//# sourceMappingURL=dailySignals.js.map