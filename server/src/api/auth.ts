import crypto from "crypto";
import { prisma } from "../db/prisma";

const HASH_ALGO = "sha256";

export function hashKey(raw: string) {
  return crypto.createHash(HASH_ALGO).update(raw).digest("hex");
}

export async function findApiKey(rawKey: string) {
  const keyHash = hashKey(rawKey);
  return prisma.apiKey.findFirst({ where: { keyHash, isActive: true } });
}

/** Generate a new raw key (returns {raw, hash}) — store hash only! */
export function generateRawKey(): { raw: string; hash: string } {
  const raw = "ck_" + crypto.randomBytes(24).toString("hex"); // e.g., ck_abcdef...
  return { raw, hash: hashKey(raw) };
}
