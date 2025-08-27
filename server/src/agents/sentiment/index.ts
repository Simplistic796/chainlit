import { AgentInput, AgentOpinion } from "../shared/types";
import { getMarketSnapshot } from "../../providers";

export async function sentimentAgent(input: AgentInput): Promise<AgentOpinion> {
  const snap = await getMarketSnapshot(input.token).catch(() => null);
  const d1 = snap?.d1Pct ?? 0;
  let stance: "BUY" | "HOLD" | "SELL" = "HOLD";
  if (d1 >= 3) stance = "BUY";
  else if (d1 <= -3) stance = "SELL";

  const confidence = Math.min(1, Math.abs(d1) / 10); // crude: bigger move = higher confidence

  return {
    agent: "sentiment",
    stance,
    confidence,
    rationale: `24h change ${d1.toFixed(2)}% used as sentiment proxy`,
    features: { d1Pct: d1, source: "coingecko" },
  };
}
