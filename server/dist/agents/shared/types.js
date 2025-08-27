"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsensusDecision = exports.DebateConfig = exports.AgentOpinion = exports.AgentInput = exports.Stance = exports.AgentType = void 0;
const zod_1 = require("zod");
exports.AgentType = zod_1.z.enum(["sentiment", "valuation", "risk"]);
exports.Stance = zod_1.z.enum(["BUY", "HOLD", "SELL"]);
exports.AgentInput = zod_1.z.object({
    token: zod_1.z.string().min(1),
    // room for shared features; we'll fill as we add providers
    context: zod_1.z.record(zod_1.z.any()).default({}),
});
exports.AgentOpinion = zod_1.z.object({
    agent: exports.AgentType,
    stance: exports.Stance,
    confidence: zod_1.z.number().min(0).max(1),
    rationale: zod_1.z.string().min(1),
    features: zod_1.z.record(zod_1.z.any()).default({}),
});
exports.DebateConfig = zod_1.z.object({
    rounds: zod_1.z.number().int().min(1).max(5).default(3),
    quorum: zod_1.z.number().min(0.5).max(1).default(0.5), // majority fraction
});
exports.ConsensusDecision = zod_1.z.object({
    decision: exports.Stance,
    confidence: zod_1.z.number().min(0).max(1),
    opinions: zod_1.z.array(exports.AgentOpinion),
    rationale: zod_1.z.array(zod_1.z.string()),
});
//# sourceMappingURL=types.js.map