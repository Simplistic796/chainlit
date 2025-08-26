// src/providers/etherscan/api.ts
import { getJSON } from "../../lib/http";

const BASE = "https://api.etherscan.io/api";
const KEY = process.env.ETHERSCAN_KEY ?? "";

type EtherscanResp<T> = { status: "0" | "1"; message: string; result: T };

export async function etherscanGet<T>(params: Record<string, string>): Promise<T | null> {
  if (!KEY) return null;
  const qs = new URLSearchParams({ ...params, apikey: KEY }).toString();
  const url = `${BASE}?${qs}`;
  const resp = await getJSON<EtherscanResp<T>>(url);
  if (resp.status !== "1") return null;
  return resp.result;
}
