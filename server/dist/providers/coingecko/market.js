"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketById = getMarketById;
// src/providers/coingecko/market.ts
const http_1 = require("../../lib/http");
const redis_1 = require("../../cache/redis");
const COINGECKO_BASE = process.env.COINGECKO_BASE ?? "https://api.coingecko.com/api/v3";
async function getMarketById(coinId, symbol) {
    const cacheKey = `cg:market:${coinId}`;
    const cached = await (0, redis_1.cacheGetJSON)(cacheKey);
    if (cached)
        return cached;
    const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(coinId)}&price_change_percentage=24h,7d`;
    const data = await (0, http_1.getJSON)(url);
    const row = data?.[0];
    if (!row)
        return null;
    const snap = {
        coinId,
        symbol: symbol.toUpperCase(),
        priceUsd: Number(row.current_price ?? 0),
        marketCap: Number(row.market_cap ?? 0),
        volume24h: Number(row.total_volume ?? 0),
        d1Pct: Number(row.price_change_percentage_24h ?? 0),
        d7Pct: Number(row.price_change_percentage_7d_in_currency ?? 0),
    };
    try {
        await (0, redis_1.cacheSetJSON)(cacheKey, snap, 60);
    }
    catch { }
    return snap;
}
//# sourceMappingURL=market.js.map