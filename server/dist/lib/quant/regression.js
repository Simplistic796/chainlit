"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ols = ols;
function ols(x, y) {
    // simple OLS: y = a + b*x
    const n = Math.min(x.length, y.length);
    if (n === 0)
        return { alpha: 0, beta: 0 };
    const mx = x.reduce((a, b) => a + b, 0) / n;
    const my = y.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
        const dx = (x[i] ?? 0) - mx;
        const dy = (y[i] ?? 0) - my;
        num += dx * dy;
        den += dx * dx;
    }
    const beta = den === 0 ? 0 : num / den;
    const alpha = my - beta * mx;
    return { alpha, beta };
}
//# sourceMappingURL=regression.js.map