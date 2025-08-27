"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.valuationAgent = valuationAgent;
const scoring_1 = require("../../lib/scoring/scoring");
const history_1 = require("../../providers/coingecko/history");
const stats_1 = require("../../lib/quant/stats");
async function valuationAgent(input) {
    // Base blended score (existing fundamentals/liquidity/holders)
    const analysis = await (0, scoring_1.analyzeToken)(input.token);
    // Pull 60d closes for better stability (falls back to 30 if 60 fails)
    let closes = await (0, history_1.getDailyClosesUSD)(input.token, 60);
    if (!closes || closes.length < 20)
        closes = await (0, history_1.getDailyClosesUSD)(input.token, 30);
    let stance = "HOLD";
    let conf = 0.5;
    let rationaleParts = [];
    if (closes && closes.length >= 20) {
        const rets = (0, stats_1.pctReturns)(closes); // daily pct returns
        const sigma = (0, stats_1.stdev)(rets); // volatility proxy
        const dd = (0, stats_1.maxDrawdown)(closes); // max drawdown fraction
        const shp = (0, stats_1.simpleSharpe)(rets); // mean/stdev (daily)
        const mu = (0, stats_1.mean)(rets);
        // Normalize features into an intuitive stance:
        // - favor higher Sharpe & positive mean returns
        // - penalize very high volatility or deep drawdowns
        // thresholds are heuristic; tune later
        const sharpeGood = shp >= 0.7;
        const sharpeBad = shp <= 0.0;
        const lowVol = sigma <= 0.04; // ~4% daily stdev
        const highVol = sigma >= 0.10; // ~10% daily stdev
        const mildDD = dd <= 0.25;
        const deepDD = dd >= 0.6;
        // Start from blended score bias
        if (analysis.score >= 70)
            stance = "BUY";
        else if (analysis.score <= 40)
            stance = "SELL";
        else
            stance = "HOLD";
        // Adjust stance by quant signals
        if (sharpeGood && mu > 0) {
            if (stance === "HOLD")
                stance = "BUY";
        }
        if (sharpeBad && (highVol || deepDD)) {
            stance = "SELL";
        }
        // Confidence from agreement between signals
        let agreement = 0;
        if (stance === "BUY") {
            if (analysis.score >= 70)
                agreement++;
            if (sharpeGood)
                agreement++;
            if (lowVol && mildDD)
                agreement++;
        }
        else if (stance === "SELL") {
            if (analysis.score <= 40)
                agreement++;
            if (sharpeBad)
                agreement++;
            if (highVol || deepDD)
                agreement++;
        }
        else {
            // HOLD: neutrality gets modest confidence
            agreement = 1;
        }
        conf = Math.min(1, 0.3 + 0.25 * agreement);
        rationaleParts.push(`Quant: daily σ ${(sigma * 100).toFixed(1)}%, max DD ${(dd * 100).toFixed(0)}%, Sharpe* ${shp.toFixed(2)}, μ ${(mu * 100).toFixed(2)}%.`, `Blend: base score ${analysis.score}/100 with quant overlays (tunable thresholds).`);
    }
    else {
        rationaleParts.push("Quant: insufficient history for volatility/drawdown (used base score only).");
        // fallback: use base score to set stance/conf
        if (analysis.score >= 70) {
            stance = "BUY";
            conf = 0.6;
        }
        else if (analysis.score <= 40) {
            stance = "SELL";
            conf = 0.6;
        }
        else {
            stance = "HOLD";
            conf = 0.5;
        }
    }
    return {
        agent: "valuation",
        stance,
        confidence: conf,
        rationale: rationaleParts.join(" "),
        features: { score: analysis.score },
    };
}
//# sourceMappingURL=index.js.map