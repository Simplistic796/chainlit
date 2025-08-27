import { AgentInput, AgentOpinion, ConsensusDecision, DebateConfig } from "../shared/types";
import { sentimentAgent } from "../sentiment";
import { valuationAgent } from "../valuation";
import { riskAgent } from "../risk";
import { prisma } from "../../db/prisma";

const AGENTS = [sentimentAgent, valuationAgent, riskAgent];

function aggregate(opinions: AgentOpinion[]): ConsensusDecision {
  // weighted vote by confidence
  const weights = { BUY: 0, HOLD: 0, SELL: 0 } as Record<"BUY"|"HOLD"|"SELL", number>;
  for (const o of opinions) weights[o.stance] += o.confidence;

  // pick max; tie-break SELL>HOLD>BUY bias to safety
  const entries = Object.entries(weights) as [("BUY"|"HOLD"|"SELL"), number][];
  entries.sort((a,b) => b[1] - a[1]);
  
  // Ensure we have at least one entry
  if (entries.length === 0) {
    return {
      decision: "HOLD",
      confidence: 0,
      opinions,
      rationale: ["No opinions available"],
    };
  }
  
  const firstEntry = entries[0];
  if (!firstEntry) {
    return {
      decision: "HOLD",
      confidence: 0,
      opinions,
      rationale: ["No entries available"],
    };
  }
  
  let decision = firstEntry[0];
  if (entries.length > 1) {
    const secondEntry = entries[1];
    if (secondEntry && firstEntry[1] === secondEntry[1]) {
      // tie → bias to risk-off
      if (weights.SELL === weights[decision]) decision = "SELL";
      else if (weights.HOLD === weights[decision]) decision = "HOLD";
    }
  }

  const confidence = Math.min(1, firstEntry[1] / Math.max(1, opinions.length)); // crude

  return {
    decision,
    confidence,
    opinions,
    rationale: opinions.map(o => `[${o.agent}] ${o.rationale}`),
  };
}

export async function debateRoundRobin(input: AgentInput, cfg: DebateConfig) {
  const allOpinions: AgentOpinion[] = [];

  for (let r = 0; r < cfg.rounds; r++) {
    for (const agent of AGENTS) {
      const op = await agent(input);
      allOpinions.push(op);
      // persist each opinion
      await prisma.agentRun.create({
        data: {
          token: input.token,
          agentType: op.agent,
          inputsJSON: input,
          outputJSON: op,
          score: typeof (op.features as any)?.score === "number" ? (op.features as any).score : null,
          confidence: op.confidence,
        },
      });
    }
  }

  const final = aggregate(allOpinions);
  const saved = await prisma.consensusRun.create({
    data: {
      token: input.token,
      decision: final.decision,
      confidence: final.confidence,
      rationaleJSON: final.rationale,
    },
  });

  return { consensusId: saved.id, ...final };
}
