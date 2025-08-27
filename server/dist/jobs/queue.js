"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeWorker = exports.analyzeEvents = exports.analyzeQueue = void 0;
exports.enqueueAnalyze = enqueueAnalyze;
// src/jobs/queue.ts
const bullmq_1 = require("bullmq");
const prisma_1 = require("../db/prisma");
const redis_1 = require("../cache/redis");
const scoring_1 = require("../lib/scoring/scoring");
// Multi-Agent Queue Names (to be implemented):
// queue:sentiment.analyze
// queue:valuation.analyze  
// queue:risk.analyze
// queue:consensus.debate
const connection = (0, redis_1.getRedisForBullMQ)();
exports.analyzeQueue = connection ? new bullmq_1.Queue("analyze", { connection: connection }) : null;
exports.analyzeEvents = connection ? new bullmq_1.QueueEvents("analyze", { connection: connection }) : null;
exports.analyzeWorker = connection
    ? new bullmq_1.Worker("analyze", async (job) => {
        const { token } = job.data;
        // 1) Run full analysis (live providers + heuristics)
        const result = await (0, scoring_1.analyzeToken)(token);
        await prisma_1.prisma.tokenLookup.create({
            data: {
                token: result.token,
                score: result.score,
                risk: result.risk,
                outlook: result.outlook,
            },
        });
        // 3) Write hot cache for quick reads (TTL ~60s)
        try {
            await (0, redis_1.cacheSetJSON)(`analysis:${token.toLowerCase()}`, result, 60);
        }
        catch { }
        return result;
    }, { connection: connection, concurrency: 2 })
    : null;
if (connection && exports.analyzeWorker) {
    exports.analyzeWorker.on("completed", (job, res) => {
        console.log(`[job completed] ${job.id} token=${job.data.token}`);
    });
    exports.analyzeWorker.on("failed", (job, err) => {
        console.error(`[job failed] ${job?.id} ${err?.message}`);
    });
}
async function enqueueAnalyze(token, opts) {
    if (!connection || !exports.analyzeQueue) {
        throw new Error("Redis not configured for BullMQ");
    }
    return exports.analyzeQueue.add("analyze-token", { token }, {
        removeOnComplete: 50,
        removeOnFail: 50,
        attempts: 2,
        backoff: { type: "exponential", delay: 1500 },
        ...(opts || {})
    });
}
//# sourceMappingURL=queue.js.map