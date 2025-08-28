import { useEffect, useState } from "react";
import axios from "axios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { Separator } from "./components/ui/separator";
import AppToaster from "./components/AppToaster";
import { useToast } from "./components/ui/use-toast";
import ScoreDial from "@/components/ScoreDial";
import AgentChip from "@/components/AgentChip";
import WatchlistCard from "@/components/WatchlistCard";
import AlertsManager from "@/components/AlertsManager";


type AnalysisResult = {
  token: string;
  score: number;
  risk: "Low" | "Medium" | "High" | string;
  outlook: "Bearish" | "Neutral" | "Bullish" | string;
  evidence: string[];
};
type RecentRow = {
  id: number;
  token: string;
  score: number;
  risk: string;
  outlook: string;
  createdAt: string;
};

type ConsensusRow = {
  id: number;
  token: string;
  decision: "BUY" | "HOLD" | "SELL" | string;
  confidence: number;
  rationaleJSON: string[];
  createdAt: string;
};

type AgentOpinionDTO = {
  id: number;
  agentType: "sentiment" | "valuation" | "risk" | string;
  output: { agent: string; stance: "BUY"|"HOLD"|"SELL"|string; confidence: number; rationale: string };
  createdAt: string;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

export default function App() {
  const { toast } = useToast();
  const [token, setToken] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  
  const [consensus, setConsensus] = useState<ConsensusRow | null>(null);
  const [debating, setDebating] = useState(false);
  const [opinions, setOpinions] = useState<AgentOpinionDTO[]>([]);



  const fetchRecent = async () => {
    try {
      setLoadingRecent(true);
      const res = await axios.get<RecentRow[]>(`${API_BASE}/recent`);
      setRecent(res.data);
    } finally {
      setLoadingRecent(false);
    }
  };

  async function fetchOpinions(tok: string) {
    try {
      const res = await axios.get<{ token: string; opinions: AgentOpinionDTO[] }>(`${API_BASE}/consensus/${encodeURIComponent(tok)}/opinions`, { params: { limit: 9 } });
      setOpinions(res.data.opinions);
    } catch {
      setOpinions([]);
    }
  }

  useEffect(() => { fetchRecent(); }, []);

  async function analyze(override?: string) {
    const q = (override ?? token).trim();
    if (!q) return;
    setLoading(true); setResult(null);
    try {
      const res = await axios.get<AnalysisResult>(`${API_BASE}/analyze`, { params: { token: q } });
      setResult(res.data);
      setToken(q);
      fetchRecent();
      toast({ title: "Analysis complete", description: `Updated analysis for ${q}` });
    } catch {
      toast({ title: "Analysis failed", description: "Check server logs or API_BASE." });
    } finally {
      setLoading(false);
    }
  }

  function riskVariant(r: string) {
    if (r === "Low") return "default";
    if (r === "Medium") return "secondary";
    return "destructive";
  }

  function outlookVariant(o: string) {
    if (o === "Bullish") return "default";
    if (o === "Neutral") return "secondary";
    return "destructive";
  }

  async function startDebate() {
    const q = token.trim();
    if (!q) return;
    setDebating(true);
    setConsensus(null);
    try {
      await axios.post(`${API_BASE}/debate`, { token: q, rounds: 3 });

      const started = Date.now();
      const poll = async () => {
        try {
          const res = await axios.get<ConsensusRow>(`${API_BASE}/consensus/${encodeURIComponent(q)}`);
          if (res.data && res.data.token.toLowerCase() === q.toLowerCase()) {
            setConsensus(res.data);
            setDebating(false);
            fetchOpinions(q);            // ← add this line
            return;
          }
        } catch {}
        if (Date.now() - started < 12000) {
          setTimeout(poll, 1500);
        } else {
          setDebating(false);
        }
      };
      poll();
    } catch {
      setDebating(false);
    }
  }

  function decisionVariant(d: string) {
    if (d === "BUY") return "default";
    if (d === "HOLD") return "secondary";
    return "destructive";
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppToaster />
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">ChainLit — Crypto Analyst</h1>
          <div className="text-sm text-muted-foreground">Not financial advice</div>
        </header>



        <Card>
          <CardHeader>
            <CardTitle>Analyze a token</CardTitle>
            <CardDescription>Enter a symbol (e.g., ETH) or contract address (0x...)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="ETH or 0x1234..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && analyze()}
              />
              <Button onClick={() => analyze()} disabled={!token || loading}>
                {loading ? "Analyzing..." : "Analyze"}
              </Button>
              <Button variant="secondary" onClick={startDebate} disabled={!token || debating}>
                {debating ? "Debating…" : "Run Debate"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card className="max-w-5xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 flex-wrap">
                Result for <span className="font-mono">{result.token}</span>
                <Badge variant={riskVariant(result.risk)}>Risk: {result.risk}</Badge>
                <Badge variant={outlookVariant(result.outlook)}>Outlook: {result.outlook}</Badge>
              </CardTitle>
              <CardDescription>Explainable score with evidence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-6 md:grid-cols-2 items-center">
                <div className="flex w-full justify-center">
                  <ScoreDial score={result.score} size="lg" className="mx-auto md:mx-0" />
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={riskVariant(result.risk)}>Risk: {result.risk}</Badge>
                    <Badge variant={outlookVariant(result.outlook)}>Outlook: {result.outlook}</Badge>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">Evidence</div>
                    <ul className="list-disc pl-6 space-y-1">
                      {result.evidence.map((ev, i) => <li key={i}>{ev}</li>)}
                    </ul>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <details>
                      <summary className="cursor-pointer hover:underline">ⓘ About the score</summary>
                      <div className="mt-2">
                        The score blends heuristic + market (CoinGecko), on-chain (Etherscan), liquidity (DexScreener),
                        and holders (Covalent). Signals are normalized and weighted; evidence lists the reasons.
                        Not financial advice.
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {consensus && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                Consensus for <span className="font-mono">{consensus.token}</span>
                <Badge variant={decisionVariant(consensus.decision)}>
                  {consensus.decision}
                </Badge>
                <Badge variant="secondary">
                  Confidence: {(consensus.confidence * 100).toFixed(0)}%
                </Badge>
              </CardTitle>
              <CardDescription>Round-robin debate outcome (Sentiment · Valuation · Risk)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Rationales</div>
              <ul className="list-disc pl-6 space-y-1">
                {consensus.rationaleJSON.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
              {opinions.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Agent opinions</div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {opinions.slice(0,3).map((op) => (
                      <AgentChip key={op.id} agent={op.agentType} stance={op.output.stance} confidence={op.output.confidence} />
                    ))}
                  </div>
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-2">
                Created: {new Date(consensus.createdAt).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Recent searches</CardTitle>
            <CardDescription>Click to re-run analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingRecent && <div>Loading…</div>}
            {!loadingRecent && recent.length === 0 && (
              <div className="text-muted-foreground">No recent searches yet.</div>
            )}
            {!loadingRecent && recent.length > 0 && (
              <div className="grid gap-2">
                {recent.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => analyze(row.token)}
                    className="text-left rounded-md border p-3 hover:bg-accent transition-colors"
                    title="Click to re-run"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-mono font-medium">{row.token}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(row.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Score <b>{row.score}</b> • Risk <b>{row.risk}</b> • Outlook <b>{row.outlook}</b>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Separator className="my-6" />

        <div className="grid gap-4 md:grid-cols-2">
          <WatchlistCard />
          <AlertsManager />
        </div>
      </div>
    </div>
  );
}
