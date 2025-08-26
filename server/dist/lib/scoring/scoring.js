"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeToken = analyzeToken;
// src/lib/scoring/scoring.ts
const providers_1 = require("../../providers");
const mockScoring_1 = require("./mockScoring");
const normalize_1 = require("../normalize");
const contract_1 = require("../../providers/etherscan/contract");
function riskFromScore(score) {
    if (score >= 70)
        return "Low";
    if (score >= 40)
        return "Medium";
    return "High";
}
async function analyzeToken(input) {
    const token = input.trim();
    const base = (0, mockScoring_1.analyzeTokenMock)(token); // heuristic stays as a foundation
    // ----- MARKET (CoinGecko) -----
    const market = await (0, providers_1.getMarketSnapshot)(token).catch(() => null);
    let evidence = [...base.evidence];
    let blended = base.score;
    let outlook = base.outlook;
    if (market) {
        const volNorm = (0, normalize_1.minmax)(market.volume24h, 1e6, 1e9);
        const momNorm = (0, normalize_1.minmax)(market.d7Pct, -30, 30);
        const marketSub = Math.round((0.6 * volNorm + 0.4 * momNorm) * 100);
        blended = Math.round((0, normalize_1.clamp)(0.7 * blended + 0.3 * marketSub, 0, 100));
        outlook = "Neutral";
        if (market.d1Pct >= 3)
            outlook = "Bullish";
        else if (market.d1Pct <= -3)
            outlook = "Bearish";
        evidence.push(`Market: 24h ${market.d1Pct.toFixed(2)}%; 7d ${market.d7Pct.toFixed(2)}%.`, `Volume: $${Intl.NumberFormat("en-US", { notation: "compact" }).format(market.volume24h)} (${(0, normalize_1.bucketLabel01)(volNorm)} vs peers).`, `Source: CoinGecko.`);
    }
    else {
        evidence.push("Market: live data unavailable; used heuristic only (fallback).");
    }
    // ----- ETHERSCAN (only if input looks like an address) -----
    const isAddress = token.toLowerCase().startsWith("0x") && token.length >= 8;
    if (isAddress) {
        const meta = await (0, contract_1.getContractMeta)(token).catch(() => null);
        if (meta) {
            if (meta.verified) {
                blended = Math.min(100, blended + 6); // small trust bump
                evidence.push(`On-chain: Contract is verified on Etherscan (compiler ${meta.compilerVersion ?? "unknown"}, license ${meta.licenseType ?? "n/a"}).`);
            }
            else {
                blended = Math.max(0, blended - 12); // stronger penalty
                evidence.push("On-chain: Contract source NOT verified on Etherscan (risk ↑).");
            }
            if (meta.proxy) {
                evidence.push(`On-chain: Contract is a PROXY${meta.implementation ? ` (implementation ${meta.implementation})` : ""}.`);
            }
        }
        else {
            evidence.push("On-chain: Etherscan metadata unavailable (no change applied).");
        }
    }
    else {
        evidence.push("On-chain: Skipped (symbol provided, not a contract address).");
    }
    const risk = (() => {
        if (blended >= 70)
            return "Low";
        if (blended >= 40)
            return "Medium";
        return "High";
    })();
    return {
        token: base.token,
        score: blended,
        risk,
        outlook,
        evidence
    };
}
//# sourceMappingURL=scoring.js.map