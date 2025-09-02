import { prisma } from "../db/prisma";

export async function isEnabled(flagKey: string, opts?: { userId?: number; plan?: string }) {
  const flag = await (prisma as any).featureFlag.findUnique({ where: { key: flagKey } });
  if (!flag) return false;
  const { userId, plan } = opts || {};

  if (userId) {
    const o = await (prisma as any).featureOverride.findFirst({
      where: { flagId: flag.id, userId },
      orderBy: { updatedAt: "desc" },
    });
    if (o) return !!o.isOn;
  }
  if (plan) {
    const o = await (prisma as any).featureOverride.findFirst({
      where: { flagId: flag.id, plan },
      orderBy: { updatedAt: "desc" },
    });
    if (o) return !!o.isOn;
  }
  return !!flag.defaultOn;
}


