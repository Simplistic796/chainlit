// src/cache/redis.ts
import IORedis from "ioredis";

const url = process.env.REDIS_URL;
let redis: IORedis | null = null;

export function getRedis(): IORedis | null {
  if (!url) return null;
  if (!redis) {
    redis = new IORedis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
      tls: url.startsWith("rediss://") ? {} : undefined,
    } as any);
    redis.on("error", (e) => console.error("[redis] error:", e.message));
    redis.on("connect", () => console.log("[redis] connected"));
  }
  return redis;
}

// Separate Redis connection for BullMQ with required options
export function getRedisForBullMQ(): IORedis | null {
  if (!url) return null;
  return new IORedis(url, {
    maxRetriesPerRequest: null, // BullMQ requirement
    enableReadyCheck: true,
    lazyConnect: false,
    tls: url.startsWith("rediss://") ? {} : undefined,
  } as any);
}

export async function cacheSetJSON(key: string, value: unknown, ttlSec = 300) {
  const r = getRedis(); if (!r) return;
  await r.set(key, JSON.stringify(value), "EX", ttlSec);
}
export async function cacheGetJSON<T>(key: string): Promise<T | null> {
  const r = getRedis(); if (!r) return null;
  const raw = await r.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}
