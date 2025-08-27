"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeToken = analyzeToken;
// src/lib/scoring/scoring.ts
const providers_1 = require("../../providers");
const mockScoring_1 = require("./mockScoring");
const normalize_1 = require("../normalize");
const contract_1 = require("../../providers/etherscan/contract");
const pairs_1 = require("../../providers/dexscreener/pairs");
const holders_1 = require("../../providers/covalent/holders");
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
    // Optional: hint if news was used (light-touch; main news logic in agent)
    try {
        const mod = await Promise.resolve().then(() => __importStar(require("../../providers/cryptopanic/news")));
        const { posts } = await mod.getNewsForToken(token);
        evidence.push(`News: ${posts.length} recent items found (CryptoPanic).`);
    }
    catch { }
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
    // ----- DEXSCREENER (if address) -----
    if (isAddress) {
        const pairs = await (0, pairs_1.getDexPairs)(token).catch(() => null);
        if (pairs && pairs.length > 0) {
            const sorted = pairs.sort((a, b) => (b.liquidity.usd ?? 0) - (a.liquidity.usd ?? 0));
            const top = sorted[0];
            if (top) {
                const liq = top.liquidity.usd ?? 0;
                const vol = top.volume.h24 ?? 0;
                const liqNorm = (0, normalize_1.minmax)(liq, 5e4, 5e7); // $50k .. $50M
                const volNorm = (0, normalize_1.minmax)(vol, 1e4, 1e7); // $10k .. $10M
                const dexSub = Math.round((0.5 * liqNorm + 0.5 * volNorm) * 100);
                blended = Math.round((0, normalize_1.clamp)(0.8 * blended + 0.2 * dexSub, 0, 100));
                evidence.push(`DEX: Liquidity ~$${Intl.NumberFormat("en-US", { notation: "compact" }).format(liq)}, 24h volume ~$${Intl.NumberFormat("en-US", { notation: "compact" }).format(vol)}.`);
                evidence.push(`Source: DexScreener (${top.dexId}, ${top.chainId}).`);
            }
        }
        else {
            evidence.push("DEX: No liquidity found on DexScreener (cannot trade?).");
            blended = Math.max(0, blended - 15);
        }
    }
    // ----- HOLDERS (Covalent) -----
    if (isAddress) {
        const holders = await (0, holders_1.getTopHolders)(token).catch(() => null);
        if (holders && holders.length > 0) {
            const totalTop = holders.reduce((sum, h) => sum + h.balance_quote, 0);
            const largest = holders[0];
            const pctTop10 = (totalTop / (market?.marketCap ?? totalTop)) * 100;
            if (pctTop10 > 50) {
                blended = Math.max(0, blended - 15);
                evidence.push(`Holders: Top 10 wallets own ~${pctTop10.toFixed(1)}% of supply (centralization risk).`);
            }
            else {
                blended = Math.min(100, blended + 5);
                evidence.push(`Holders: Top 10 wallets own ~${pctTop10.toFixed(1)}% of supply (healthy spread).`);
            }
            if (largest) {
                evidence.push(`Largest wallet holds ~$${Intl.NumberFormat("en-US", { notation: "compact" }).format(largest.balance_quote)} worth.`);
            }
        }
        else {
            evidence.push("Holders: Covalent data unavailable.");
        }
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