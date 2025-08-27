"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTopHolders = getTopHolders;
// src/providers/covalent/holders.ts
const http_1 = require("../../lib/http");
const KEY = process.env.COVALENT_API_KEY ?? "";
const BASE = "https://api.covalenthq.com/v1";
async function getTopHolders(address, chainId = 1, limit = 10) {
    if (!KEY)
        return null;
    const url = `${BASE}/${chainId}/tokens/${address}/token_holders/?page-size=${limit}&key=${KEY}`;
    const resp = await (0, http_1.getJSON)(url).catch(() => null);
    if (!resp?.data?.items)
        return null;
    return resp.data.items;
}
//# sourceMappingURL=holders.js.map