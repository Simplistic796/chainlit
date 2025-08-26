"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.etherscanGet = etherscanGet;
// src/providers/etherscan/api.ts
const http_1 = require("../../lib/http");
const BASE = "https://api.etherscan.io/api";
const KEY = process.env.ETHERSCAN_KEY ?? "";
async function etherscanGet(params) {
    if (!KEY)
        return null;
    const qs = new URLSearchParams({ ...params, apikey: KEY }).toString();
    const url = `${BASE}?${qs}`;
    const resp = await (0, http_1.getJSON)(url);
    if (resp.status !== "1")
        return null;
    return resp.result;
}
//# sourceMappingURL=api.js.map