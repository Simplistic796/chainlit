"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEnabled = isEnabled;
const prisma_1 = require("../db/prisma");
async function isEnabled(flagKey, opts) {
    const flag = await prisma_1.prisma.featureFlag.findUnique({ where: { key: flagKey } });
    if (!flag)
        return false;
    const { userId, plan } = opts || {};
    if (userId) {
        const o = await prisma_1.prisma.featureOverride.findFirst({
            where: { flagId: flag.id, userId },
            orderBy: { updatedAt: "desc" },
        });
        if (o)
            return !!o.isOn;
    }
    if (plan) {
        const o = await prisma_1.prisma.featureOverride.findFirst({
            where: { flagId: flag.id, plan },
            orderBy: { updatedAt: "desc" },
        });
        if (o)
            return !!o.isOn;
    }
    return !!flag.defaultOn;
}
//# sourceMappingURL=flags.js.map