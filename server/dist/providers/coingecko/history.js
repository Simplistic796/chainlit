"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDailyClosesUSD = getDailyClosesUSD;
// src/providers/coingecko/history.ts
const http_1 = require("../../lib/http");
const redis_1 = require("../../cache/redis");
const coinsList_1 = require("./coinsList");
const COINGECKO_BASE = process.env.COINGECKO_BASE ?? "https://api.coingecko.com/api/v3";
async function getDailyClosesUSD(input, days = 30) {
    const resolved = await (0, coinsList_1.resolveToCoinId)(input).catch(() => null);
    if (!resolved)
        return null;
    const id = resolved.id;
    const cacheKey = `cg:hist:${id}:${days}`;
    const cached = await (0, redis_1.cacheGetJSON)(cacheKey);
    if (cached && cached.length)
        return cached;
    const url = `${COINGECKO_BASE}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
    const data = await (0, http_1.getJSON)(url).catch(() => null);
    if (!data?.prices?.length)
        return null;
    // prices = [ [timestamp_ms, price], ... ] → extract closes
    const closes = data.prices.map(([, price]) => Number(price)).filter((x) => Number.isFinite(x));
    try {
        await (0, redis_1.cacheSetJSON)(cacheKey, closes, 60 * 30);
    }
    catch { } // cache 30 min
    return closes;
}
//# sourceMappingURL=history.js.map