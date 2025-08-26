// src/providers/dexscreener/pairs.ts
import { getJSON } from "../../lib/http";
import { cacheGetJSON, cacheSetJSON } from "../../cache/redis";

const BASE = "https://api.dexscreener.com/latest/dex";

export type DexPair = {
  chainId: string;
  dexId: string;
  url: string;
  baseToken: { address: string; symbol: string; name: string };
  quoteToken: { address: string; symbol: string; name: string };
  liquidity: { usd: number };
  volume: { h24: number };
  priceUsd: string;
};

type Resp = { pairs?: DexPair[] };

export async function getDexPairs(address: string): Promise<DexPair[] | null> {
  const key = `dex:pair:${address.toLowerCase()}`;
  const cached = await cacheGetJSON<DexPair[]>(key);
  if (cached) return cached;

  const url = `${BASE}/tokens/${address}`;
  const resp = await getJSON<Resp>(url).catch(() => null);
  if (!resp?.pairs) return null;

  try { await cacheSetJSON(key, resp.pairs, 60); } catch {}
  return resp.pairs;
}
