import { z } from "zod";

export const AgentType = z.enum(["sentiment", "valuation", "risk"]);
export type AgentType = z.infer<typeof AgentType>;

export const Stance = z.enum(["BUY", "HOLD", "SELL"]);
export type Stance = z.infer<typeof Stance>;

export const AgentInput = z.object({
  token: z.string().min(1),
  // room for shared features; we'll fill as we add providers
  context: z.record(z.any()).default({}),
});
export type AgentInput = z.infer<typeof AgentInput>;

export const AgentOpinion = z.object({
  agent: AgentType,
  stance: Stance,
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  features: z.record(z.any()).default({}),
});
export type AgentOpinion = z.infer<typeof AgentOpinion>;

export const DebateConfig = z.object({
  rounds: z.number().int().min(1).max(5).default(3),
  quorum: z.number().min(0.5).max(1).default(0.5), // majority fraction
});
export type DebateConfig = z.infer<typeof DebateConfig>;

export const ConsensusDecision = z.object({
  decision: Stance,
  confidence: z.number().min(0).max(1),
  opinions: z.array(AgentOpinion),
  rationale: z.array(z.string()),
});
export type ConsensusDecision = z.infer<typeof ConsensusDecision>;
