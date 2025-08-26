// src/providers/coingecko/market.ts
import { getJSON } from "../../lib/http";
import { cacheGetJSON, cacheSetJSON } from "../../cache/redis";

const COINGECKO_BASE = process.env.COINGECKO_BASE ?? "https://api.coingecko.com/api/v3";

export type MarketSnapshot = {
  coinId: string;
  symbol: string;
  priceUsd: number;
  marketCap: number;
  volume24h: number;
  d1Pct: number;  // 24h change %
  d7Pct: number;  // 7d change %
};

export async function getMarketById(coinId: string, symbol: string): Promise<MarketSnapshot | null> {
  const cacheKey = `cg:market:${coinId}`;
  const cached = await cacheGetJSON<MarketSnapshot>(cacheKey);
  if (cached) return cached;

  const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(
    coinId
  )}&price_change_percentage=24h,7d`;

  type Resp = Array<{
    id: string;
    symbol: string;
    current_price: number;
    market_cap: number;
    total_volume: number;
    price_change_percentage_24h: number | null;
    price_change_percentage_7d_in_currency?: number | null;
  }>;

  const data = await getJSON<Resp>(url);
  const row = data?.[0];
  if (!row) return null;

  const snap: MarketSnapshot = {
    coinId,
    symbol: symbol.toUpperCase(),
    priceUsd: Number(row.current_price ?? 0),
    marketCap: Number(row.market_cap ?? 0),
    volume24h: Number(row.total_volume ?? 0),
    d1Pct: Number(row.price_change_percentage_24h ?? 0),
    d7Pct: Number(row.price_change_percentage_7d_in_currency ?? 0),
  };

  try { await cacheSetJSON(cacheKey, snap, 60); } catch {}
  return snap;
}

