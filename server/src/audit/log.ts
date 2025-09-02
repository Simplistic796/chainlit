import { prisma } from "../db/prisma";

export async function audit(opts: {
  userId?: number | undefined;
  apiKeyId?: number | undefined;
  action: string;
  target?: string | undefined;
  meta?: any;
}) {
  try {
    await (prisma as any).auditLog.create({ data: opts as any });
  } catch {
    // best-effort
  }
}


