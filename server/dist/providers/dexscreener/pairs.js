"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDexPairs = getDexPairs;
// src/providers/dexscreener/pairs.ts
const http_1 = require("../../lib/http");
const redis_1 = require("../../cache/redis");
const BASE = "https://api.dexscreener.com/latest/dex";
async function getDexPairs(address) {
    const key = `dex:pair:${address.toLowerCase()}`;
    const cached = await (0, redis_1.cacheGetJSON)(key);
    if (cached)
        return cached;
    const url = `${BASE}/tokens/${address}`;
    const resp = await (0, http_1.getJSON)(url).catch(() => null);
    if (!resp?.pairs)
        return null;
    try {
        await (0, redis_1.cacheSetJSON)(key, resp.pairs, 60);
    }
    catch { }
    return resp.pairs;
}
//# sourceMappingURL=pairs.js.map