import { Request, Response, NextFunction } from "express";
import { LRUCache } from "lru-cache";
import { findApiKey } from "./auth";
import { prisma } from "../db/prisma";

// Minute window counters per key
const minuteBucket = new LRUCache<string, { count: number; resetAt: number }>({
  max: 5000,
  ttl: 1000 * 60 * 10, // keep buckets for 10m
});

function todayKey(keyId: number) {
  const d = new Date();
  return `${keyId}:${d.getUTCFullYear()}${(d.getUTCMonth()+1).toString().padStart(2,"0")}${d.getUTCDate().toString().padStart(2,"0")}`;
}
const dayCount = new LRUCache<string, number>({ max: 10000, ttl: 1000 * 60 * 60 * 6 });

export async function apiAuth(req: Request, res: Response, next: NextFunction) {
  const raw = (req.header("x-api-key") || "").trim();
  if (!raw) return res.status(401).json({ ok: false, error: "missing_api_key" });

  const key = await findApiKey(raw);
  if (!key) return res.status(403).json({ ok: false, error: "invalid_or_inactive_api_key" });

  // Rate by minute
  const now = Date.now();
  const mbKey = `m:${key.id}`;
  const bucket = minuteBucket.get(mbKey) || { count: 0, resetAt: now + 60_000 };
  if (now > bucket.resetAt) { bucket.count = 0; bucket.resetAt = now + 60_000; }
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
  (req as any).apiKey = key;
  next();
}

export async function logApiUsage(req: Request, res: Response, next: NextFunction) {
  res.on("finish", async () => {
    try {
      const key = (req as any).apiKey;
      if (!key) return;
      const latencyMs = (req as any)._latencyMs ?? null;
      await prisma.apiUsage.create({
        data: { apiKeyId: key.id, endpoint: req.path, status: res.statusCode, latencyMs },
      });
    } catch { /* ignore logging failures */ }
  });
  next();
}

// Consistent envelope
export function ok<T>(res: Response, data: T) {
  return res.json({ ok: true, data });
}
export function fail(res: Response, status: number, error: string, details?: any) {
  return res.status(status).json({ ok: false, error, details });
}
