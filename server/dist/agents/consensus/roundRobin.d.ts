import { AgentInput, DebateConfig } from "../shared/types";
export declare function debateRoundRobin(input: AgentInput, cfg: DebateConfig): Promise<{
    confidence: number;
    rationale: string[];
    decision: "BUY" | "HOLD" | "SELL";
    opinions: {
        agent: "risk" | "sentiment" | "valuation";
        stance: "BUY" | "HOLD" | "SELL";
        confidence: number;
        rationale: string;
        features: Record<string, any>;
    }[];
    consensusId: number;
}>;
//# sourceMappingURL=roundRobin.d.ts.map