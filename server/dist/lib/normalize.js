"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clamp = clamp;
exports.minmax = minmax;
exports.bucketLabel01 = bucketLabel01;
// src/lib/normalize.ts
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
function minmax(n, min, max) {
    if (max === min)
        return 0.5;
    return clamp((n - min) / (max - min), 0, 1);
}
function bucketLabel01(x) {
    if (x >= 0.67)
        return "strong";
    if (x >= 0.33)
        return "moderate";
    return "weak";
}
//# sourceMappingURL=normalize.js.map