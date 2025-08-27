"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNewsForToken = getNewsForToken;
// src/providers/cryptopanic/news.ts
const http_1 = require("../../lib/http");
const redis_1 = require("../../cache/redis");
const coinsList_1 = require("../coingecko/coinsList"); // to map an address to a symbol if needed
const BASE = "https://cryptopanic.com/api/v1";
const KEY = process.env.CRYPTOPANIC_KEY ?? "";
function pickSymbol(input) {
    // If it's an address, we try to resolve to a known symbol via coingecko list.
    const lc = input.toLowerCase();
    return lc.startsWith("0x") ? null : input.toUpperCase();
}
async function getNewsForToken(input) {
    if (!KEY) {
        const sym = pickSymbol(input) || undefined;
        return sym ? { symbol: sym, posts: [] } : { posts: [] };
    }
    let symbol = pickSymbol(input);
    if (!symbol) {
        // try resolve address -> symbol (best-effort)
        const resolved = await (0, coinsList_1.resolveToCoinId)(input).catch(() => null);
        if (resolved?.symbol)
            symbol = resolved.symbol.toUpperCase();
    }
    if (!symbol)
        return { posts: [] };
    const cacheKey = `cp:news:${symbol}`;
    const cached = await (0, redis_1.cacheGetJSON)(cacheKey);
    if (cached)
        return cached;
    const url = `${BASE}/posts/?auth_token=${encodeURIComponent(KEY)}&currencies=${encodeURIComponent(symbol)}&kind=news`;
    const resp = await (0, http_1.getJSON)(url).catch(() => ({ results: [] }));
    const data = { symbol, posts: resp.results?.slice(0, 20) ?? [] };
    try {
        await (0, redis_1.cacheSetJSON)(cacheKey, data, 300);
    }
    catch { }
    return data;
}
//# sourceMappingURL=news.js.map