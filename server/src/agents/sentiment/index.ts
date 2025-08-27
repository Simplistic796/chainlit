import { AgentInput, AgentOpinion } from "../shared/types";
import { getMarketSnapshot } from "../../providers";
import { getNewsForToken } from "../../providers/cryptopanic/news";

export async function sentimentAgent(input: AgentInput): Promise<AgentOpinion> {
  // 1) Try real news sentiment first
  const news = await getNewsForToken(input.token).catch(() => ({ posts: [] as any[] } as any));
  const posts = (news.posts ?? []) as any[];
  let score = 0;
  for (const p of posts) {
    const v = (p as any).votes || {};
    // simple heuristic: pos + 2*important - neg
    score += (v.positive ?? 0) + 2 * (v.important ?? 0) - (v.negative ?? 0);
  }
  // normalize roughly by number of posts (avoid division by zero)
  const norm = posts.length > 0 ? score / (3 * posts.length) : 0; // typical range ~[-1..+1]
  // clamp to [-1..1]
  const clamped = Math.max(-1, Math.min(1, norm));

  let stance: "BUY" | "HOLD" | "SELL" = "HOLD";
  if (clamped >= 0.25) stance = "BUY";
  else if (clamped <= -0.25) stance = "SELL";

  // map |clamped| to [0..1] for confidence
  let confidence = Math.min(1, Math.abs(clamped));

  let rationale = `News sentiment: ${posts.length} recent articles; aggregate vote score=${score.toFixed(2)} (normalized ${clamped.toFixed(2)}).`;

  // 2) If no news posts, fall back to 24h momentum proxy (what you had)
  if (posts.length === 0) {
    const snap = await getMarketSnapshot(input.token).catch(() => null);
    const d1 = (snap as any)?.d1Pct ?? 0;
    if (d1 >= 3) stance = "BUY";
    else if (d1 <= -3) stance = "SELL";
    confidence = Math.min(1, Math.abs(d1) / 10);
    rationale = `No recent news; fallback to 24h change ${d1.toFixed(2)}% as sentiment proxy.`;
  }

  return {
    agent: "sentiment",
    stance,
    confidence,
    rationale,
    features: { posts: posts.length, newsSymbol: (news as any)?.symbol, aggregateScore: score, normalized: clamped },
  };
}
