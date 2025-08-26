"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeToken = analyzeToken;
// src/lib/scoring/scoring.ts
const providers_1 = require("../../providers");
const mockScoring_1 = require("./mockScoring");
const normalize_1 = require("../normalize");
function riskFromScore(score) {
    if (score >= 70)
        return "Low";
    if (score >= 40)
        return "Medium";
    return "High";
}
async function analyzeToken(input) {
    const token = input.trim();
    const base = (0, mockScoring_1.analyzeTokenMock)(token); // deterministic heuristic
    // Try live market data; if it fails, return heuristic + note
    const market = await (0, providers_1.getMarketSnapshot)(token).catch(() => null);
    if (!market) {
        return {
            ...base,
            evidence: [
                ...base.evidence,
                "Market: live data unavailable; used heuristic only (MVP fallback).",
            ],
        };
    }
    // Normalize market signals
    // NOTE: these ranges are heuristic; we'll refine later.
    const volNorm = (0, normalize_1.minmax)(market.volume24h, 1e6, 1e9); // $1M .. $1B
    const momNorm = (0, normalize_1.minmax)(market.d7Pct, -30, 30); // -30% .. +30%
    // Market sub-score (0..100)
    const marketSub = Math.round((0.6 * volNorm + 0.4 * momNorm) * 100);
    // Blend with base heuristic (weights adjustable)
    const blended = Math.round((0, normalize_1.clamp)(0.7 * base.score + 0.3 * marketSub, 0, 100));
    // Outlook from short momentum
    let outlook = "Neutral";
    if (market.d1Pct >= 3)
        outlook = "Bullish";
    else if (market.d1Pct <= -3)
        outlook = "Bearish";
    const evidence = [
        ...base.evidence,
        `Market: 24h change ${market.d1Pct.toFixed(2)}%; 7d ${market.d7Pct.toFixed(2)}%.`,
        `Volume: $${Intl.NumberFormat("en-US", { notation: "compact" }).format(market.volume24h)} (${(0, normalize_1.bucketLabel01)(volNorm)} vs peers).`,
        `Source: CoinGecko (${market.source}).`,
    ];
    return {
        token: base.token,
        score: blended,
        risk: riskFromScore(blended),
        outlook,
        evidence,
    };
}
//# sourceMappingURL=scoring.js.map