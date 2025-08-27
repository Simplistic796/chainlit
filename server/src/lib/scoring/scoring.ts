// src/lib/scoring/scoring.ts
import { getMarketSnapshot } from "../../providers";
import { analyzeTokenMock } from "./mockScoring";
import { minmax, clamp, bucketLabel01 } from "../normalize";
import { getContractMeta } from "../../providers/etherscan/contract";
import { getDexPairs } from "../../providers/dexscreener/pairs";
import { getTopHolders } from "../../providers/covalent/holders";



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

  let evidence = [...base.evidence];
  let blended = base.score;
  let outlook: AnalysisResult["outlook"] = base.outlook;

  if (market) {
    const volNorm = minmax(market.volume24h, 1e6, 1e9);
    const momNorm = minmax(market.d7Pct, -30, 30);
    const marketSub = Math.round((0.6 * volNorm + 0.4 * momNorm) * 100);
    blended = Math.round(clamp(0.7 * blended + 0.3 * marketSub, 0, 100));

    outlook = "Neutral";
    if (market.d1Pct >= 3) outlook = "Bullish";
    else if (market.d1Pct <= -3) outlook = "Bearish";

    evidence.push(
      `Market: 24h ${market.d1Pct.toFixed(2)}%; 7d ${market.d7Pct.toFixed(2)}%.`,
      `Volume: $${Intl.NumberFormat("en-US", { notation: "compact" }).format(market.volume24h)} (${bucketLabel01(volNorm)} vs peers).`,
      `Source: CoinGecko.`
    );
  } else {
    evidence.push("Market: live data unavailable; used heuristic only (fallback).");
  }

  // Optional: hint if news was used (light-touch; main news logic in agent)
  try {
    const mod = await import("../../providers/cryptopanic/news");
    const { posts } = await mod.getNewsForToken(token);
    evidence.push(`News: ${posts.length} recent items found (CryptoPanic).`);
  } catch {}

  // ----- ETHERSCAN (only if input looks like an address) -----
  const isAddress = token.toLowerCase().startsWith("0x") && token.length >= 8;
  if (isAddress) {
    const meta = await getContractMeta(token).catch(() => null);
    if (meta) {
      if (meta.verified) {
        blended = Math.min(100, blended + 6); // small trust bump
        evidence.push(`On-chain: Contract is verified on Etherscan (compiler ${meta.compilerVersion ?? "unknown"}, license ${meta.licenseType ?? "n/a"}).`);
      } else {
        blended = Math.max(0, blended - 12); // stronger penalty
        evidence.push("On-chain: Contract source NOT verified on Etherscan (risk ↑).");
      }

      if (meta.proxy) {
        evidence.push(`On-chain: Contract is a PROXY${meta.implementation ? ` (implementation ${meta.implementation})` : ""}.`);
      }

    } else {
      evidence.push("On-chain: Etherscan metadata unavailable (no change applied).");
    }
  } else {
    evidence.push("On-chain: Skipped (symbol provided, not a contract address).");
  }

  // ----- DEXSCREENER (if address) -----
  if (isAddress) {
    const pairs = await getDexPairs(token).catch(() => null);
    if (pairs && pairs.length > 0) {
      const sorted = pairs.sort((a, b) => (b.liquidity.usd ?? 0) - (a.liquidity.usd ?? 0));
      const top = sorted[0];
      if (top) {
        const liq = top.liquidity.usd ?? 0;
        const vol = top.volume.h24 ?? 0;

        const liqNorm = minmax(liq, 5e4, 5e7); // $50k .. $50M
        const volNorm = minmax(vol, 1e4, 1e7); // $10k .. $10M
        const dexSub = Math.round((0.5 * liqNorm + 0.5 * volNorm) * 100);

        blended = Math.round(clamp(0.8 * blended + 0.2 * dexSub, 0, 100));

        evidence.push(
          `DEX: Liquidity ~$${Intl.NumberFormat("en-US", { notation: "compact" }).format(liq)}, 24h volume ~$${Intl.NumberFormat("en-US", { notation: "compact" }).format(vol)}.`
        );
        evidence.push(`Source: DexScreener (${top.dexId}, ${top.chainId}).`);
      }
    } else {
      evidence.push("DEX: No liquidity found on DexScreener (cannot trade?).");
      blended = Math.max(0, blended - 15);
    }
  }

  // ----- HOLDERS (Covalent) -----
  if (isAddress) {
    const holders = await getTopHolders(token).catch(() => null);
    if (holders && holders.length > 0) {
      const totalTop = holders.reduce((sum, h) => sum + h.balance_quote, 0);
      const largest = holders[0];
      const pctTop10 = (totalTop / (market?.marketCap ?? totalTop)) * 100;

      if (pctTop10 > 50) {
        blended = Math.max(0, blended - 15);
        evidence.push(`Holders: Top 10 wallets own ~${pctTop10.toFixed(1)}% of supply (centralization risk).`);
      } else {
        blended = Math.min(100, blended + 5);
        evidence.push(`Holders: Top 10 wallets own ~${pctTop10.toFixed(1)}% of supply (healthy spread).`);
      }

      if (largest) {
        evidence.push(`Largest wallet holds ~$${Intl.NumberFormat("en-US", { notation: "compact" }).format(largest.balance_quote)} worth.`);
      }
    } else {
      evidence.push("Holders: Covalent data unavailable.");
    }
  }

  const risk = ((): AnalysisResult["risk"] => {
    if (blended >= 70) return "Low";
    if (blended >= 40) return "Medium";
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


