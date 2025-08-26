"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeWorker = exports.analyzeEvents = exports.analyzeQueue = void 0;
exports.enqueueAnalyze = enqueueAnalyze;
// src/jobs/queue.ts
const bullmq_1 = require("bullmq");
const prisma_1 = require("../db/prisma");
const redis_1 = require("../cache/redis");
const mockScoring_1 = require("../lib/scoring/mockScoring"); // will swap with real scoring later
const connection = (0, redis_1.getRedisForBullMQ)();
exports.analyzeQueue = new bullmq_1.Queue("analyze", { connection: connection });
exports.analyzeEvents = new bullmq_1.QueueEvents("analyze", { connection: connection });
exports.analyzeWorker = new bullmq_1.Worker("analyze", async (job) => {
    const { token } = job.data;
    // TODO: replace with real data fetch & scoring
    const result = (0, mockScoring_1.analyzeTokenMock)(token);
    await prisma_1.prisma.tokenLookup.create({
        data: {
            token: result.token,
            score: result.score,
            risk: result.risk,
            outlook: result.outlook,
        },
    });
    return result;
}, { connection: connection, concurrency: 2 });
exports.analyzeWorker.on("completed", (job, res) => {
    console.log(`[job completed] ${job.id} token=${job.data.token} score=${res?.score}`);
});
exports.analyzeWorker.on("failed", (job, err) => {
    console.error(`[job failed] ${job?.id} ${err?.message}`);
});
async function enqueueAnalyze(token, opts) {
    return exports.analyzeQueue.add("analyze-token", { token }, { removeOnComplete: 50, removeOnFail: 50, ...(opts || {}) });
}
//# sourceMappingURL=queue.js.map