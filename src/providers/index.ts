// src/providers/index.ts
import { resolveToCoinId } from "./coingecko/coinsList";
import { getMarketById, MarketSnapshot } from "./coingecko/market";

export type UnifiedMarket = MarketSnapshot & { source: "coingecko" };

export async function getMarketSnapshot(input: string): Promise<UnifiedMarket | null> {
  const resolved = await resolveToCoinId(input);
  if (!resolved) return null;
  const snap = await getMarketById(resolved.id, resolved.symbol);
  if (!snap) return null;
  return { ...snap, source: "coingecko" };
}

