import { AgentInput, AgentOpinion } from "../shared/types";
import { analyzeToken } from "../../lib/scoring/scoring";

export async function riskAgent(input: AgentInput): Promise<AgentOpinion> {
  const analysis = await analyzeToken(input.token);
  // map risk to stance bias
  let stance: "BUY" | "HOLD" | "SELL" = "HOLD";
  if (analysis.risk === "Low") stance = "BUY";
  if (analysis.risk === "High") stance = "SELL";

  const confidence = analysis.risk === "Low" ? 0.7 : analysis.risk === "High" ? 0.8 : 0.5;

  // Extra guardrails: if evidence mentions "No liquidity found" or "source NOT verified"
  const redFlag = analysis.evidence.some(e =>
    /No liquidity found|NOT verified/i.test(e)
  );
  const finalStance = redFlag ? "SELL" : stance;
  const finalConf = redFlag ? Math.max(confidence, 0.8) : confidence;

  return {
    agent: "risk",
    stance: finalStance,
    confidence: finalConf,
    rationale: `Risk level ${analysis.risk}${redFlag ? "; red flag detected" : ""}`,
    features: { risk: analysis.risk, redFlag },
  };
}
