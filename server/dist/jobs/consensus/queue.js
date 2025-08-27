"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debateWorker = exports.debateQueue = void 0;
exports.enqueueDebate = enqueueDebate;
const bullmq_1 = require("bullmq");
const redis_1 = require("../../cache/redis");
const roundRobin_1 = require("../../agents/consensus/roundRobin");
const connection = (0, redis_1.getRedisForBullMQ)();
exports.debateQueue = new bullmq_1.Queue("consensus.debate", { connection: connection });
exports.debateWorker = new bullmq_1.Worker("consensus.debate", async (job) => {
    const cfg = { rounds: 3, quorum: 0.5, ...(job.data.cfg || {}) };
    return (0, roundRobin_1.debateRoundRobin)(job.data.input, cfg);
}, { connection: connection, concurrency: 2 });
async function enqueueDebate(input, opts) {
    return exports.debateQueue.add("debate", { input }, { removeOnComplete: 50, removeOnFail: 50, ...(opts || {}) });
}
//# sourceMappingURL=queue.js.map