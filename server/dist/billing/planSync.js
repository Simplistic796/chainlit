"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyPlanToUserKeys = applyPlanToUserKeys;
const prisma_1 = require("../db/prisma");
const plans_1 = require("./plans");
async function applyPlanToUserKeys(userId, plan) {
    const { rpm, rpd } = plans_1.PLAN_LIMITS[plan];
    await prisma_1.prisma.apiKey.updateMany({
        where: { userId },
        data: { plan, requestsPerMin: rpm, requestsPerDay: rpd },
    });
}
//# sourceMappingURL=planSync.js.map