"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiAuth = apiAuth;
exports.logApiUsage = logApiUsage;
exports.ok = ok;
exports.fail = fail;
const lru_cache_1 = require("lru-cache");
const auth_1 = require("./auth");
const prisma_1 = require("../db/prisma");
// Minute window counters per key
const minuteBucket = new lru_cache_1.LRUCache({
    max: 5000,
    ttl: 1000 * 60 * 10, // keep buckets for 10m
});
function todayKey(keyId) {
    const d = new Date();
    return `${keyId}:${d.getUTCFullYear()}${(d.getUTCMonth() + 1).toString().padStart(2, "0")}${d.getUTCDate().toString().padStart(2, "0")}`;
}
const dayCount = new lru_cache_1.LRUCache({ max: 10000, ttl: 1000 * 60 * 60 * 6 });
async function apiAuth(req, res, next) {
    const raw = (req.header("x-api-key") || "").trim();
    if (!raw)
        return res.status(401).json({ ok: false, error: "missing_api_key" });
    const key = await (0, auth_1.findApiKey)(raw);
    if (!key)
        return res.status(403).json({ ok: false, error: "invalid_or_inactive_api_key" });
    // Rate by minute
    const now = Date.now();
    const mbKey = `m:${key.id}`;
    const bucket = minuteBucket.get(mbKey) || { count: 0, resetAt: now + 60_000 };
    if (now > bucket.resetAt) {
        bucket.count = 0;
        bucket.resetAt = now + 60_000;
    }
    bucket.count += 1;
    minuteBucket.set(mbKey, bucket);
    if (bucket.count > key.requestsPerMin) {
        return res.status(429).json({ ok: false, error: "rate_limited_minute", resetAt: bucket.resetAt });
    }
    // Rate by day (approx; persisted usage still recorded below)
    const dk = todayKey(key.id);
    const used = (dayCount.get(dk) || 0) + 1;
    dayCount.set(dk, used);
    if (used > key.requestsPerDay) {
        return res.status(429).json({ ok: false, error: "rate_limited_day" });
    }
    // attach key to request for later usage log
    req.apiKey = key;
    next();
}
async function logApiUsage(req, res, next) {
    res.on("finish", async () => {
        try {
            const key = req.apiKey;
            if (!key)
                return;
            await prisma_1.prisma.apiUsage.create({
                data: { apiKeyId: key.id, endpoint: req.path, status: res.statusCode },
            });
        }
        catch { /* ignore logging failures */ }
    });
    next();
}
// Consistent envelope
function ok(res, data) {
    return res.json({ ok: true, data });
}
function fail(res, status, error, details) {
    return res.status(status).json({ ok: false, error, details });
}
//# sourceMappingURL=mw.js.map