"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCoinsList = getCoinsList;
exports.resolveToCoinId = resolveToCoinId;
// src/providers/coingecko/coinsList.ts
const redis_1 = require("../../cache/redis");
const http_1 = require("../../lib/http");
const COINGECKO_BASE = process.env.COINGECKO_BASE ?? "https://api.coingecko.com/api/v3";
const LIST_CACHE_KEY = "cg:coins:list:v1";
const LIST_TTL_SEC = 60 * 60 * 12; // 12h
async function getCoinsList() {
    const cached = await (0, redis_1.cacheGetJSON)(LIST_CACHE_KEY);
    if (cached && cached.length)
        return cached;
    const url = `${COINGECKO_BASE}/coins/list?include_platform=true`;
    const list = await (0, http_1.getJSON)(url);
    // cache but don't fail if redis isn't configured
    try {
        await (0, redis_1.cacheSetJSON)(LIST_CACHE_KEY, list, LIST_TTL_SEC);
    }
    catch { }
    return list;
}
async function resolveToCoinId(inputRaw) {
    const input = inputRaw.trim();
    const list = await getCoinsList();
    const lower = input.toLowerCase();
    // If looks like an ETH address -> address lookup across platforms
    const isAddress = lower.startsWith("0x") && lower.length >= 8;
    if (isAddress) {
        for (const c of list) {
            if (!c.platforms)
                continue;
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
        const first = candidates[0];
        if (first && first.symbol) {
            return { id: first.id, symbol: first.symbol.toUpperCase() };
        }
    }
    // Loose name contains
    const byName = list.find(c => c.name && c.name.toLowerCase() === lower);
    if (byName)
        return { id: byName.id, symbol: byName.symbol.toUpperCase() };
    return null;
}
//# sourceMappingURL=coinsList.js.map