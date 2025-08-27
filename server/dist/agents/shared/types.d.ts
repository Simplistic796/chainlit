import { z } from "zod";
export declare const AgentType: z.ZodEnum<["sentiment", "valuation", "risk"]>;
export type AgentType = z.infer<typeof AgentType>;
export declare const Stance: z.ZodEnum<["BUY", "HOLD", "SELL"]>;
export type Stance = z.infer<typeof Stance>;
export declare const AgentInput: z.ZodObject<{
    token: z.ZodString;
    context: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    token: string;
    context: Record<string, any>;
}, {
    token: string;
    context?: Record<string, any> | undefined;
}>;
export type AgentInput = z.infer<typeof AgentInput>;
export declare const AgentOpinion: z.ZodObject<{
    agent: z.ZodEnum<["sentiment", "valuation", "risk"]>;
    stance: z.ZodEnum<["BUY", "HOLD", "SELL"]>;
    confidence: z.ZodNumber;
    rationale: z.ZodString;
    features: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    agent: "risk" | "sentiment" | "valuation";
    stance: "BUY" | "HOLD" | "SELL";
    confidence: number;
    rationale: string;
    features: Record<string, any>;
}, {
    agent: "risk" | "sentiment" | "valuation";
    stance: "BUY" | "HOLD" | "SELL";
    confidence: number;
    rationale: string;
    features?: Record<string, any> | undefined;
}>;
export type AgentOpinion = z.infer<typeof AgentOpinion>;
export declare const DebateConfig: z.ZodObject<{
    rounds: z.ZodDefault<z.ZodNumber>;
    quorum: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    rounds: number;
    quorum: number;
}, {
    rounds?: number | undefined;
    quorum?: number | undefined;
}>;
export type DebateConfig = z.infer<typeof DebateConfig>;
export declare const ConsensusDecision: z.ZodObject<{
    decision: z.ZodEnum<["BUY", "HOLD", "SELL"]>;
    confidence: z.ZodNumber;
    opinions: z.ZodArray<z.ZodObject<{
        agent: z.ZodEnum<["sentiment", "valuation", "risk"]>;
        stance: z.ZodEnum<["BUY", "HOLD", "SELL"]>;
        confidence: z.ZodNumber;
        rationale: z.ZodString;
        features: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        agent: "risk" | "sentiment" | "valuation";
        stance: "BUY" | "HOLD" | "SELL";
        confidence: number;
        rationale: string;
        features: Record<string, any>;
    }, {
        agent: "risk" | "sentiment" | "valuation";
        stance: "BUY" | "HOLD" | "SELL";
        confidence: number;
        rationale: string;
        features?: Record<string, any> | undefined;
    }>, "many">;
    rationale: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
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
}, {
    confidence: number;
    rationale: string[];
    decision: "BUY" | "HOLD" | "SELL";
    opinions: {
        agent: "risk" | "sentiment" | "valuation";
        stance: "BUY" | "HOLD" | "SELL";
        confidence: number;
        rationale: string;
        features?: Record<string, any> | undefined;
    }[];
}>;
export type ConsensusDecision = z.infer<typeof ConsensusDecision>;
//# sourceMappingURL=types.d.ts.map