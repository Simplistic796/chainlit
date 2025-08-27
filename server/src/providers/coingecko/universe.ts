import { getJSON } from "../../lib/http";

type MarketRow = { id: string; symbol: string; current_price: number };
export async function getTopSymbols(limit = 100): Promise<{ symbol: string; price: number }[]> {
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${Math.min(250, limit)}&page=1&price_change_percentage=24h`;
  const rows = await getJSON<MarketRow[]>(url).catch(() => []);
  return rows.map(r => ({ symbol: r.symbol.toUpperCase(), price: r.current_price ?? 0 }));
}
