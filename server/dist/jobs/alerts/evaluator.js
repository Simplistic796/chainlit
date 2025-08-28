"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertsWorker = exports.alertsQueue = void 0;
exports.scheduleAlertEvaluator = scheduleAlertEvaluator;
const bullmq_1 = require("bullmq");
const redis_1 = require("../../cache/redis");
const prisma_1 = require("../../db/prisma");
const node_fetch_1 = __importDefault(require("node-fetch"));
const connection = (0, redis_1.getRedis)();
exports.alertsQueue = new bullmq_1.Queue("alerts.eval", { connection: connection });
async function notifyWebhook(url, payload) {
    try {
        await (0, node_fetch_1.default)(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    catch { }
}
exports.alertsWorker = new bullmq_1.Worker("alerts.eval", async () => {
    // For each active alert, evaluate condition on the latest two days of SignalDaily and latest ConsensusRun
    const alerts = await prisma_1.prisma.alert.findMany({ where: { isActive: true } });
    if (alerts.length === 0)
        return { processed: 0 };
    // Preload latest signals grouped by token (today and yesterday)
    const since = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    const signals = await prisma_1.prisma.signalDaily.findMany({
        where: { date: { gte: new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate())) } },
        orderBy: [{ date: "desc" }],
    });
    const mapByToken = new Map();
    for (const s of signals) {
        const k = s.token.toUpperCase();
        const arr = mapByToken.get(k) || [];
        arr.push(s);
        mapByToken.set(k, arr);
    }
    let fired = 0;
    for (const a of alerts) {
        const token = a.token.toUpperCase();
        const rows = mapByToken.get(token) || [];
        const latest = rows[0];
        const prev = rows[1];
        let shouldFire = false;
        let reason = "";
        if (a.type === "consensus_flip" && latest && prev) {
            if (latest.decision !== prev.decision) {
                shouldFire = true;
                reason = `Consensus flipped ${prev.decision} -> ${latest.decision}`;
            }
        }
        if (a.type === "score_threshold" && latest) {
            const thr = Number(a.condition?.scoreGte ?? NaN);
            if (!Number.isNaN(thr) && latest.score >= thr) {
                shouldFire = true;
                reason = `Score ${latest.score} >= ${thr}`;
            }
        }
        if (a.type === "risk_change" && latest && prev) {
            if (latest.risk !== prev.risk) {
                shouldFire = true;
                reason = `Risk changed ${prev.risk} -> ${latest.risk}`;
            }
        }
        if (!shouldFire)
            continue;
        const payload = {
            token: a.token,
            type: a.type,
            reason,
            snapshot: latest ?? null,
            at: new Date().toISOString(),
        };
        const evt = await prisma_1.prisma.alertEvent.create({
            data: { alertId: a.id, apiKeyId: a.apiKeyId, token: a.token, payload, delivered: false },
        });
        if (a.channel === "webhook") {
            await notifyWebhook(a.target, payload);
        }
        // (email channel can be added later)
        await prisma_1.prisma.alertEvent.update({ where: { id: evt.id }, data: { delivered: true } });
        fired++;
    }
    return { processed: alerts.length, fired };
}, { connection: connection, concurrency: 1 });
// schedule every 5 minutes
async function scheduleAlertEvaluator() {
    await exports.alertsQueue.add("tick", {}, { repeat: { every: 5 * 60 * 1000 }, removeOnComplete: 50, removeOnFail: 50 });
}
//# sourceMappingURL=evaluator.js.map