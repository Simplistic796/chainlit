"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsRollupWorker = exports.analyticsRollupQueue = void 0;
exports.enqueueAnalyticsRollup = enqueueAnalyticsRollup;
exports.scheduleDailyRollup = scheduleDailyRollup;
// src/jobs/analytics/rollup.ts
const bullmq_1 = require("bullmq");
const prisma_1 = require("../../db/prisma");
const redis_1 = require("../../cache/redis");
const logger_1 = require("../../observability/logger");
const connection = (0, redis_1.getRedisForBullMQ)();
exports.analyticsRollupQueue = connection
    ? new bullmq_1.Queue("analytics.rollup", { connection: connection })
    : null;
exports.analyticsRollupWorker = connection
    ? new bullmq_1.Worker("analytics.rollup", async (job) => {
        const { date } = job.data;
        // Default to yesterday UTC if no date provided
        const targetDate = date ? new Date(`${date}T00:00:00.000Z`) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const dateStr = targetDate.toISOString().split('T')[0];
        logger_1.logger.info({ date: dateStr }, "Starting analytics rollup for date");
        try {
            // Get all API keys that had usage on this date
            const apiKeysWithUsage = await prisma_1.prisma.apiUsage.groupBy({
                by: ['apiKeyId'],
                where: {
                    createdAt: {
                        gte: targetDate,
                        lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
                    }
                }
            });
            logger_1.logger.info({ count: apiKeysWithUsage.length }, "Found API keys with usage for date");
            // Process each API key
            for (const { apiKeyId } of apiKeysWithUsage) {
                await processApiKeyRollup(apiKeyId, targetDate, dateStr);
            }
            logger_1.logger.info({ date: dateStr }, "Analytics rollup completed successfully");
            return { processed: apiKeysWithUsage.length, date: dateStr };
        }
        catch (error) {
            logger_1.logger.error({ error, date: dateStr }, "Analytics rollup failed");
            throw error;
        }
    }, { connection: connection, concurrency: 1 })
    : null;
async function processApiKeyRollup(apiKeyId, targetDate, dateStr) {
    const startOfDay = targetDate;
    const endOfDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
    // Aggregate usage data for this API key and date
    const usageData = await prisma_1.prisma.apiUsage.groupBy({
        by: ['status', 'endpoint'],
        where: {
            apiKeyId,
            createdAt: {
                gte: startOfDay,
                lt: endOfDay
            }
        },
        _count: {
            status: true
        }
    });
    // Calculate metrics
    let totalRequests = 0;
    let ok2xx = 0;
    let client4xx = 0;
    let server5xx = 0;
    const endpointCounts = {};
    for (const item of usageData) {
        const count = item._count.status;
        totalRequests += count;
        // Categorize by status code
        if (item.status >= 200 && item.status < 300) {
            ok2xx += count;
        }
        else if (item.status >= 400 && item.status < 500) {
            client4xx += count;
        }
        else if (item.status >= 500) {
            server5xx += count;
        }
        // Count endpoint usage
        endpointCounts[item.endpoint] = (endpointCounts[item.endpoint] || 0) + count;
    }
    // Find top endpoint
    const topEndpoint = Object.entries(endpointCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 1)
        .map(([endpoint, count]) => ({ endpoint, count }))[0];
    // Upsert the daily rollup
    await prisma_1.prisma.apiUsageDaily.upsert({
        where: {
            apiKeyId_date: {
                apiKeyId,
                date: startOfDay
            }
        },
        update: {
            requests: totalRequests,
            ok2xx,
            client4xx,
            server5xx,
            topEndpoint: topEndpoint || null,
            updatedAt: new Date()
        },
        create: {
            apiKeyId,
            date: startOfDay,
            requests: totalRequests,
            ok2xx,
            client4xx,
            server5xx,
            topEndpoint: topEndpoint || null
        }
    });
    logger_1.logger.debug({
        apiKeyId,
        date: dateStr,
        requests: totalRequests,
        ok2xx,
        client4xx,
        server5xx
    }, "Processed API key rollup");
}
async function enqueueAnalyticsRollup(date, opts) {
    if (!connection || !exports.analyticsRollupQueue) {
        throw new Error("Redis not configured for BullMQ");
    }
    return exports.analyticsRollupQueue.add("rollup", { date: date || undefined }, {
        removeOnComplete: 10,
        removeOnFail: 10,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        ...(opts || {})
    });
}
// Schedule daily rollup at 05:30 UTC
async function scheduleDailyRollup() {
    if (!connection || !exports.analyticsRollupQueue) {
        logger_1.logger.warn("Redis not configured, skipping analytics rollup scheduler");
        return;
    }
    // Schedule for 05:30 UTC every day
    await exports.analyticsRollupQueue.add("rollup", {}, {
        repeat: {
            pattern: "30 5 * * *" // cron: 30 minutes past 5 AM UTC every day
        },
        removeOnComplete: 10,
        removeOnFail: 10
    });
    logger_1.logger.info("Scheduled daily analytics rollup at 05:30 UTC");
}
if (connection && exports.analyticsRollupWorker) {
    exports.analyticsRollupWorker.on("completed", (job, res) => {
        logger_1.logger.info({ jobId: job.id, result: res }, "Analytics rollup job completed");
    });
    exports.analyticsRollupWorker.on("failed", (job, err) => {
        logger_1.logger.error({ jobId: job?.id, error: err?.message }, "Analytics rollup job failed");
    });
}
//# sourceMappingURL=rollup.js.map