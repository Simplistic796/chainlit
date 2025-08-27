// src/providers/covalent/holders.ts
import { getJSON } from "../../lib/http";

const KEY = process.env.COVALENT_API_KEY ?? "";
const BASE = "https://api.covalenthq.com/v1";

export type HolderInfo = {
  address: string;
  balance: string;
  balance_quote: number; // USD estimate
};

type Resp = {
  data: {
    items: HolderInfo[];
    pagination: { has_more: boolean; page_number: number; page_size: number; total_count: number };
  };
  error: boolean;
  error_message: string | null;
};

export async function getTopHolders(address: string, chainId = 1, limit = 10) {
  if (!KEY) return null;
  const url = `${BASE}/${chainId}/tokens/${address}/token_holders/?page-size=${limit}&key=${KEY}`;
  const resp = await getJSON<Resp>(url).catch(() => null);
  if (!resp?.data?.items) return null;
  return resp.data.items;
}
