"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketSnapshot = getMarketSnapshot;
// src/providers/index.ts
const coinsList_1 = require("./coingecko/coinsList");
const market_1 = require("./coingecko/market");
async function getMarketSnapshot(input) {
    const resolved = await (0, coinsList_1.resolveToCoinId)(input);
    if (!resolved)
        return null;
    const snap = await (0, market_1.getMarketById)(resolved.id, resolved.symbol);
    if (!snap)
        return null;
    return { ...snap, source: "coingecko" };
}
//# sourceMappingURL=index.js.map