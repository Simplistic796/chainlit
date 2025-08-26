"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedis = getRedis;
exports.getRedisForBullMQ = getRedisForBullMQ;
exports.cacheSetJSON = cacheSetJSON;
exports.cacheGetJSON = cacheGetJSON;
// src/cache/redis.ts
const ioredis_1 = __importDefault(require("ioredis"));
const url = process.env.REDIS_URL;
let redis = null;
function getRedis() {
    if (!url)
        return null;
    if (!redis) {
        redis = new ioredis_1.default(url, {
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: false,
            tls: url.startsWith("rediss://") ? {} : undefined,
        });
        redis.on("error", (e) => console.error("[redis] error:", e.message));
        redis.on("connect", () => console.log("[redis] connected"));
    }
    return redis;
}
// Separate Redis connection for BullMQ with required options
function getRedisForBullMQ() {
    if (!url)
        return null;
    return new ioredis_1.default(url, {
        maxRetriesPerRequest: null, // BullMQ requirement
        enableReadyCheck: true,
        lazyConnect: false,
        tls: url.startsWith("rediss://") ? {} : undefined,
    });
}
async function cacheSetJSON(key, value, ttlSec = 300) {
    const r = getRedis();
    if (!r)
        return;
    await r.set(key, JSON.stringify(value), "EX", ttlSec);
}
async function cacheGetJSON(key) {
    const r = getRedis();
    if (!r)
        return null;
    const raw = await r.get(key);
    return raw ? JSON.parse(raw) : null;
}
//# sourceMappingURL=redis.js.map