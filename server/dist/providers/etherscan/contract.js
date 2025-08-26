"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContractMeta = getContractMeta;
// src/providers/etherscan/contract.ts
const api_1 = require("./api");
async function getContractMeta(address) {
    const result = await (0, api_1.etherscanGet)({ module: "contract", action: "getsourcecode", address });
    if (!result || !Array.isArray(result) || result.length === 0)
        return null;
    const row = result[0];
    if (!row)
        return null;
    const verified = !!row.SourceCode && row.SourceCode !== "Contract source code not verified";
    const meta = {
        verified,
        proxy: row.Proxy === "1",
        implementation: row.Implementation || null,
    };
    if (row.ContractName)
        meta.contractName = row.ContractName;
    if (row.CompilerVersion)
        meta.compilerVersion = row.CompilerVersion;
    if (row.LicenseType)
        meta.licenseType = row.LicenseType;
    return meta;
}
//# sourceMappingURL=contract.js.map