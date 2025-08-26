// src/lib/scoring/scoring.ts
import { getMarketSnapshot } from "../../providers";
import { analyzeTokenMock } from "./mockScoring";
import { minmax, clamp, bucketLabel01 } from "../normalize";
import { getDexPairs } from "../../providers/dexscreener/pairs";
import { getContractMeta } from "../../providers/etherscan/contract";

export type AnalysisResult = {
  token: string;
  score: number; // 0-100
  risk: "Low" | "Medium" | "High";
  outlook: "Bearish" | "Neutral" | "Bullish";
  evidence: string[];
};

function riskFromScore(score: number): AnalysisResult["risk"] {
  if (score >= 70) return "Low";
  if (score >= 40) return "Medium";
  return "High";
}

export async function analyzeToken(input: string): Promise<AnalysisResult> {
  const token = input.trim();
  const base = analyzeTokenMock(token); // heuristic stays as a foundation

  // ----- MARKET (CoinGecko) -----
  const market = await getMarketSnapshot(token).catch(() => null);
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
  // NOTE: these ranges are heuristic; we’ll refine later.
  const volNorm = minmax(market.volume24h, 1e6, 1e9);   // $1M .. $1B
  const momNorm = minmax(market.d7Pct, -30, 30);        // -30% .. +30%

  // Market sub-score (0..100)
  const marketSub = Math.round((0.6 * volNorm + 0.4 * momNorm) * 100);

  // Blend with base heuristic (weights adjustable)
  const blended = Math.round(clamp(0.7 * base.score + 0.3 * marketSub, 0, 100));

  // Outlook from short momentum
  let outlook: AnalysisResult["outlook"] = "Neutral";
  if (market.d1Pct >= 3) outlook = "Bullish";
  else if (market.d1Pct <= -3) outlook = "Bearish";

  const evidence = [
    ...base.evidence,
    `Market: 24h change ${market.d1Pct.toFixed(2)}%; 7d ${market.d7Pct.toFixed(2)}%.`,
    `Volume: $${Intl.NumberFormat("en-US", { notation: "compact" }).format(market.volume24h)} (${bucketLabel01(volNorm)} vs peers).`,
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

