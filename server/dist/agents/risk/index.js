"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.riskAgent = riskAgent;
const scoring_1 = require("../../lib/scoring/scoring");
async function riskAgent(input) {
    const analysis = await (0, scoring_1.analyzeToken)(input.token);
    // map risk to stance bias
    let stance = "HOLD";
    if (analysis.risk === "Low")
        stance = "BUY";
    if (analysis.risk === "High")
        stance = "SELL";
    const confidence = analysis.risk === "Low" ? 0.7 : analysis.risk === "High" ? 0.8 : 0.5;
    // Extra guardrails: if evidence mentions "No liquidity found" or "source NOT verified"
    const redFlag = analysis.evidence.some(e => /No liquidity found|NOT verified/i.test(e));
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
//# sourceMappingURL=index.js.map