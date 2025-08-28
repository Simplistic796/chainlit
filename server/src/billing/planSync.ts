import { prisma } from "../db/prisma";
import { PLAN_LIMITS, PlanName } from "./plans";

export async function applyPlanToUserKeys(userId: number, plan: PlanName) {
  const { rpm, rpd } = PLAN_LIMITS[plan];
  await prisma.apiKey.updateMany({
    where: { userId },
    data:  { plan, requestsPerMin: rpm, requestsPerDay: rpd },
  });
}
