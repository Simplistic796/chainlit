"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pctReturns = pctReturns;
exports.mean = mean;
exports.stdev = stdev;
exports.maxDrawdown = maxDrawdown;
exports.simpleSharpe = simpleSharpe;
// src/lib/quant/stats.ts
function pctReturns(closes) {
    const r = [];
    for (let i = 1; i < closes.length; i++) {
        const prev = closes[i - 1];
        const curr = closes[i];
        if (typeof prev !== "number" ||
            typeof curr !== "number" ||
            !Number.isFinite(prev) ||
            !Number.isFinite(curr) ||
            prev <= 0) {
            continue;
        }
        r.push((curr - prev) / prev);
    }
    return r;
}
function mean(xs) {
    if (xs.length === 0)
        return 0;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function stdev(xs) {
    if (xs.length < 2)
        return 0;
    const m = mean(xs);
    const v = xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1);
    return Math.sqrt(v);
}
/** Max drawdown based on running peaks of the price series */
function maxDrawdown(closes) {
    if (closes.length === 0)
        return 0;
    let peak = typeof closes[0] === "number" ? closes[0] : 0;
    let maxDD = 0;
    for (const p of closes) {
        if (typeof p !== "number" || !Number.isFinite(p))
            continue;
        if (p > peak)
            peak = p;
        if (peak > 0) {
            const dd = (p - peak) / peak; // negative or zero
            if (dd < maxDD)
                maxDD = dd;
        }
    }
    return Math.abs(maxDD); // return as positive fraction
}
/** Simple Sharpe-style ratio: mean daily return / stdev of daily returns */
function simpleSharpe(dailyRets) {
    const s = stdev(dailyRets);
    if (s === 0)
        return 0;
    return mean(dailyRets) / s;
}
//# sourceMappingURL=stats.js.map