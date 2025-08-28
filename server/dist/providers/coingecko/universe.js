"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTopSymbols = getTopSymbols;
const http_1 = require("../../lib/http");
async function getTopSymbols(limit = 100) {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${Math.min(250, limit)}&page=1&price_change_percentage=24h`;
    const rows = await (0, http_1.getJSON)(url).catch(() => []);
    return rows.map(r => ({ symbol: r.symbol.toUpperCase(), price: r.current_price ?? 0 }));
}
//# sourceMappingURL=universe.js.map