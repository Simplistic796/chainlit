import { prisma } from "../db/prisma";
import { hashKey } from "./auth";

let cached: any = null;

export async function getUiApiKey() {
  if (cached) return cached;
  const raw = process.env.DEMO_API_KEY || "";
  console.log("DEMO_API_KEY:", raw ? "SET" : "NOT SET");
  if (!raw) throw new Error("DEMO_API_KEY not set");
  const keyHash = hashKey(raw);
  console.log("Looking for key hash:", keyHash);
  const key = await prisma.apiKey.findFirst({ where: { keyHash, isActive: true } });
  if (!key) throw new Error("DEMO_API_KEY hash not found in DB (make sure you created the key)");
  console.log("Found API key:", key.id);
  cached = key;
  return key;
}
