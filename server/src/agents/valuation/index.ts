import { AgentInput, AgentOpinion } from "../shared/types";
import { analyzeToken } from "../../lib/scoring/scoring";

export async function valuationAgent(input: AgentInput): Promise<AgentOpinion> {
  const analysis = await analyzeToken(input.token);
  const s = analysis.score;

  let stance: "BUY" | "HOLD" | "SELL" = "HOLD";
  if (s >= 70) stance = "BUY";
  else if (s <= 40) stance = "SELL";

  const confidence = Math.min(1, Math.abs(s - 50) / 50); // farther from 50 → higher confidence

  return {
    agent: "valuation",
    stance,
    confidence,
    rationale: `Blended score ${s}/100 used as valuation-quality proxy`,
    features: { score: s, risk: analysis.risk, outlook: analysis.outlook },
  };
}
