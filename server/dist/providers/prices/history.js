"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPriceHistory = getPriceHistory;
exports.getDailyClosesUSD = getDailyClosesUSD;
// src/providers/prices/history.ts
const http_1 = require("../../lib/http");
const redis_1 = require("../../cache/redis");
const coinsList_1 = require("../coingecko/coinsList");
const COINGECKO_BASE = process.env.COINGECKO_BASE ?? "https://api.coingecko.com/api/v3";
// Cache for symbol -> CoinGecko ID mapping
const symbolToIdCache = new Map();
const CACHE_TTL = 60 * 15; // 15 minutes
async function getCoinGeckoId(symbol) {
    // Check in-memory cache first
    if (symbolToIdCache.has(symbol)) {
        return symbolToIdCache.get(symbol);
    }
    try {
        const resolved = await (0, coinsList_1.resolveToCoinId)(symbol);
        if (resolved) {
            symbolToIdCache.set(symbol, resolved.id);
            return resolved.id;
        }
    }
    catch (error) {
        console.warn(`Failed to resolve ${symbol} to CoinGecko ID:`, error);
    }
    return null;
}
async function fetchDailyCloses(id, days) {
    const cacheKey = `cg:hist:${id}:${days}`;
    // Try cache first
    const cached = await (0, redis_1.cacheGetJSON)(cacheKey);
    if (cached && cached.length)
        return cached;
    try {
        const url = `${COINGECKO_BASE}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
        const data = await (0, http_1.getJSON)(url);
        if (!data?.prices?.length)
            return null;
        // Extract daily closes from [timestamp, price] pairs
        const closes = data.prices.map(([, price]) => Number(price)).filter(Number.isFinite);
        // Cache for 15 minutes to avoid rate limits
        try {
            await (0, redis_1.cacheSetJSON)(cacheKey, closes, CACHE_TTL);
        }
        catch (cacheError) {
            console.warn(`Failed to cache price data for ${id}:`, cacheError);
        }
        return closes;
    }
    catch (error) {
        console.warn(`Failed to fetch price data for ${id}:`, error);
        return null;
    }
}
async function getPriceHistory(request) {
    const { tokens, days, includeBenchmarks = true } = request;
    // Always include BTC and ETH as benchmarks
    const allTokens = includeBenchmarks ? [...tokens, 'BTC', 'ETH'] : tokens;
    // Resolve all symbols to CoinGecko IDs
    const tokenIds = new Map();
    for (const token of allTokens) {
        const id = await getCoinGeckoId(token);
        if (id) {
            tokenIds.set(token, id);
        }
        else {
            console.warn(`Skipping ${token} - could not resolve to CoinGecko ID`);
        }
    }
    if (tokenIds.size === 0) {
        console.warn('No valid tokens found for price history request');
        return null;
    }
    // Fetch price data for all tokens in parallel
    const pricePromises = Array.from(tokenIds.entries()).map(async ([token, id]) => {
        const closes = await fetchDailyCloses(id, days);
        return { token, closes };
    });
    const priceResults = await Promise.all(pricePromises);
    // Filter out failed requests
    const validPrices = priceResults.filter(result => result.closes !== null);
    if (validPrices.length === 0) {
        console.warn('No valid price data retrieved');
        return null;
    }
    // Find the minimum length to ensure all arrays have the same number of data points
    const minLength = Math.min(...validPrices.map(r => r.closes.length));
    if (minLength === 0) {
        console.warn('No price data points available');
        return null;
    }
    // Generate date array (most recent first, then going backwards)
    const dates = [];
    const now = new Date();
    for (let i = 0; i < minLength; i++) {
        const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
        const dateStr = date.toISOString().split('T')[0];
        if (dateStr)
            dates.unshift(dateStr); // YYYY-MM-DD format
    }
    // Build response structure
    const closes = {};
    const benchmarks = { btc: [], eth: [] };
    for (const { token, closes: tokenCloses } of validPrices) {
        if (tokenCloses) {
            // Take the last minLength elements (most recent data)
            const recentCloses = tokenCloses.slice(-minLength);
            if (token === 'BTC') {
                benchmarks.btc = recentCloses;
            }
            else if (token === 'ETH') {
                benchmarks.eth = recentCloses;
            }
            else {
                closes[token] = recentCloses;
            }
        }
    }
    return {
        dates,
        closes,
        benchmarks
    };
}
// Helper function to get just the daily closes for a single token
async function getDailyClosesUSD(symbol, days) {
    const id = await getCoinGeckoId(symbol);
    if (!id)
        return null;
    return fetchDailyCloses(id, days);
}
//# sourceMappingURL=history.js.map