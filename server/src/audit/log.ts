import { prisma } from "../db/prisma";

export async function audit(opts: {
  userId?: number;
  apiKeyId?: number;
  action: string;
  target?: string;
  meta?: any;
}) {
  try {
    await (prisma as any).auditLog.create({ data: opts as any });
  } catch {
    // best-effort
  }
}


