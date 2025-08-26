// src/providers/coingecko/coinsList.ts
import { cacheGetJSON, cacheSetJSON } from "../../cache/redis";
import { getJSON } from "../../lib/http";

const COINGECKO_BASE = process.env.COINGECKO_BASE ?? "https://api.coingecko.com/api/v3";
const LIST_CACHE_KEY = "cg:coins:list:v1";
const LIST_TTL_SEC = 60 * 60 * 12; // 12h

export type CGCoin = {
  id: string;
  symbol: string;
  name: string;
  platforms?: Record<string, string | null>;
};

export async function getCoinsList(): Promise<CGCoin[]> {
  const cached = await cacheGetJSON<CGCoin[]>(LIST_CACHE_KEY);
  if (cached && cached.length) return cached;

  const url = `${COINGECKO_BASE}/coins/list?include_platform=true`;
  const list = await getJSON<CGCoin[]>(url);
  // cache but don't fail if redis isn't configured
  try { await cacheSetJSON(LIST_CACHE_KEY, list, LIST_TTL_SEC); } catch {}
  return list;
}

export async function resolveToCoinId(inputRaw: string): Promise<{ id: string; symbol: string } | null> {
  const input = inputRaw.trim();
  const list = await getCoinsList();
  const lower = input.toLowerCase();

  // If looks like an ETH address -> address lookup across platforms
  const isAddress = lower.startsWith("0x") && lower.length >= 8;

  if (isAddress) {
    for (const c of list) {
      if (!c.platforms) continue;
      // common keys include 'ethereum', 'polygon-pos', etc.
      for (const [_chain, addr] of Object.entries(c.platforms)) {
        if (addr && addr.toLowerCase() === lower) {
          return { id: c.id, symbol: c.symbol.toUpperCase() };
        }
      }
    }
    return null;
  }

  // Symbol match (prefer exact symbol length 2-5)
  const candidates = list.filter(c => c.symbol && c.symbol.toLowerCase() === lower);
  if (candidates.length > 0) {
    // prefer well-known ids if duplicates (heuristic: shorter id)
    candidates.sort((a, b) => a.id.length - b.id.length);
    return { id: candidates[0].id, symbol: candidates[0].symbol.toUpperCase() };
  }

  // Loose name contains
  const byName = list.find(c => c.name && c.name.toLowerCase() === lower);
  if (byName) return { id: byName.id, symbol: byName.symbol.toUpperCase() };

  return null;
}

