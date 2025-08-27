// src/providers/cryptopanic/news.ts
import { getJSON } from "../../lib/http";
import { cacheGetJSON, cacheSetJSON } from "../../cache/redis";
import { resolveToCoinId } from "../coingecko/coinsList"; // to map an address to a symbol if needed

const BASE = "https://cryptopanic.com/api/v1";
const KEY = process.env.CRYPTOPANIC_KEY ?? "";

export type CPPost = {
  title: string;
  url: string;
  published_at: string;
  source: { title: string; domain: string };
  votes?: { negative?: number; positive?: number; important?: number; saved?: number; liked?: number; disliked?: number; };
  currencies?: Array<{ code: string }>;
};

type Resp = { results: CPPost[] };

function pickSymbol(input: string) {
  // If it's an address, we try to resolve to a known symbol via coingecko list.
  const lc = input.toLowerCase();
  return lc.startsWith("0x") ? null : input.toUpperCase();
}

export async function getNewsForToken(input: string): Promise<{ symbol?: string; posts: CPPost[] }> {
  if (!KEY) {
    const sym = pickSymbol(input) || undefined;
    return sym ? { symbol: sym, posts: [] } : { posts: [] };
  }

  let symbol = pickSymbol(input);
  if (!symbol) {
    // try resolve address -> symbol (best-effort)
    const resolved = await resolveToCoinId(input).catch(() => null);
    if (resolved?.symbol) symbol = resolved.symbol.toUpperCase();
  }
  if (!symbol) return { posts: [] };

  const cacheKey = `cp:news:${symbol}`;
  const cached = await cacheGetJSON<{ symbol: string; posts: CPPost[] }>(cacheKey);
  if (cached) return cached;

  const url = `${BASE}/posts/?auth_token=${encodeURIComponent(KEY)}&currencies=${encodeURIComponent(symbol)}&kind=news`;
  const resp = await getJSON<Resp>(url).catch(() => ({ results: [] as CPPost[] }));
  const data = { symbol, posts: resp.results?.slice(0, 20) ?? [] };

  try { await cacheSetJSON(cacheKey, data, 300); } catch {}
  return data;
}
