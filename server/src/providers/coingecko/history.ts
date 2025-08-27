// src/providers/coingecko/history.ts
import { getJSON } from "../../lib/http";
import { cacheGetJSON, cacheSetJSON } from "../../cache/redis";
import { resolveToCoinId } from "./coinsList";

const COINGECKO_BASE = process.env.COINGECKO_BASE ?? "https://api.coingecko.com/api/v3";

type MarketChartResp = {
  prices: [number, number][];
  // also market_caps / total_volumes, unused here
};

export async function getDailyClosesUSD(input: string, days = 30): Promise<number[] | null> {
  const resolved = await resolveToCoinId(input).catch(() => null);
  if (!resolved) return null;
  const id = resolved.id;

  const cacheKey = `cg:hist:${id}:${days}`;
  const cached = await cacheGetJSON<number[]>(cacheKey);
  if (cached && cached.length) return cached;

  const url = `${COINGECKO_BASE}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const data = await getJSON<MarketChartResp>(url).catch(() => null);
  if (!data?.prices?.length) return null;

  // prices = [ [timestamp_ms, price], ... ] → extract closes
  const closes = data.prices.map(([, price]) => Number(price)).filter((x) => Number.isFinite(x));
  try { await cacheSetJSON(cacheKey, closes, 60 * 30); } catch {} // cache 30 min
  return closes;
}

