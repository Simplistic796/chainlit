import { useEffect, useState } from "react";
import axios from "axios";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

type Holding = { id: number; token: string; weight: number };

export default function PortfolioCard() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [token, setToken] = useState("");
  const [weight, setWeight] = useState("0.10"); // default 10%

  async function load() {
    try {
      const r = await axios.get<{ ok: boolean; data: { portfolio: any; holdings: Holding[] } }>(`${API_BASE}/ui/portfolio`);
      setHoldings(Array.isArray(r.data?.data?.holdings) ? r.data.data.holdings : []);
    } catch {
      setHoldings([]);
    }
  }
  async function save() {
    if (!token.trim()) return;
    const w = Number(weight);
    if (!Number.isFinite(w) || w < 0 || w > 1) return alert("Weight must be between 0 and 1");
    try {
      await axios.post(`${API_BASE}/ui/portfolio/holdings`, { token: token.trim().toUpperCase(), weight: w });
      setToken("");
      await load();
    } catch {}
  }
  async function remove(t: string) {
    try {
      await axios.delete(`${API_BASE}/ui/portfolio/holdings/${encodeURIComponent(t)}`);
    } catch {}
    await load();
  }

  useEffect(() => { load(); }, []);

  const sum = holdings.reduce((a, h) => a + h.weight, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio</CardTitle>
        <CardDescription>Equal-weight or custom weights (sum ≈ 1.0)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input placeholder="Token (e.g., ETH)" value={token} onChange={(e) => setToken(e.target.value)} />
          <Input placeholder="Weight (0..1)" value={weight} onChange={(e) => setWeight(e.target.value)} />
          <Button onClick={save}>Save</Button>
        </div>

        <div className="text-xs text-muted-foreground">Total weight: {(sum).toFixed(2)}</div>

        <div className="grid gap-2">
          {holdings.length === 0 && <div className="text-sm text-muted-foreground">No holdings yet.</div>}
          {holdings.map(h => (
            <div key={h.id} className="flex items-center justify-between rounded border p-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{h.token}</Badge>
                <span className="text-xs">w={(h.weight).toFixed(2)}</span>
              </div>
              <Button size="sm" variant="destructive" onClick={() => remove(h.token)}>Remove</Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
