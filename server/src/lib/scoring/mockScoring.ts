// src/lib/scoring/mockScoring.ts

/**
 * A simple, deterministic scoring engine for MVP.
 * - It does NOT call real APIs yet.
 * - It produces explainable outputs based on token text.
 */

export type AnalysisResult = {
  token: string;
  score: number; // 0-100
  risk: "Low" | "Medium" | "High";
  outlook: "Bearish" | "Neutral" | "Bullish";
  evidence: string[];
};

// helper: basic symbol/address check
export function inferTokenType(input: string): "symbol" | "address" {
  const s = input.trim();
  if (s.startsWith("0x") && s.length >= 8) return "address";
  return "symbol";
}

// simple hash to keep “randomness” stable per token
function stableHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function riskFromScore(score: number): AnalysisResult["risk"] {
  if (score >= 70) return "Low";
  if (score >= 40) return "Medium";
  return "High";
}

function outlookFromHash(h: number): AnalysisResult["outlook"] {
  const mod = h % 3;
  if (mod === 0) return "Bearish";
  if (mod === 1) return "Neutral";
  return "Bullish";
}

export function analyzeTokenMock(raw: string): AnalysisResult {
  const token = raw.trim();
  const type = inferTokenType(token);
  const h = stableHash(token);

  // Build a base score from a few cheap “signals”
  let score = 50;

  // Heuristic bumps/dings:
  // - Symbols with 3-4 caps feel established (e.g., ETH, BTC)
  if (type === "symbol") {
    if (/^[A-Z]{2,5}$/.test(token)) score += 10;
    if (token.length > 5) score -= 5; // overlong ticker looks sus
  }

  // - Addresses: give neutral base, then small offset based on hash
  if (type === "address") {
    score += (h % 11) - 5; // [-5..+5]
  }

  // - Basic “red-flag words” in symbol (for demo)
  const lower = token.toLowerCase();
  if (/(inu|moon|pump|elon|shib)/.test(lower)) score -= 10;

  // - Slight bump for “blue-chip-ish” names
  if (/^(BTC|ETH|SOL|BNB|USDC|USDT)$/.test(token)) score += 15;

  score = clamp(score, 0, 100);

  const risk = riskFromScore(score);
  const outlook = outlookFromHash(h);

  // Evidence is transparent, simple, and maps to your categories:
  const evidence = [
    `Fundamentals: Token type inferred as ${type.toUpperCase()}; no team info checked in MVP.`,
    `Tokenomics: Heuristic scoring based on symbol patterns (length/case) only in MVP.`,
    `Market Quality: No live liquidity/volume data in MVP yet (placeholder).`,
    `Sentiment: Not fetched yet; outlook derived deterministically from token hash (placeholder).`,
    `On-Chain: Not queried in MVP; address format considered if provided.`,
    `Scam Checks: Flagged common meme keywords; comprehensive checks deferred.`,
  ];

  return { token, score, risk, outlook, evidence };
}

