"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.audit = audit;
const prisma_1 = require("../db/prisma");
async function audit(opts) {
    try {
        await prisma_1.prisma.auditLog.create({ data: opts });
    }
    catch {
        // best-effort
    }
}
//# sourceMappingURL=log.js.map