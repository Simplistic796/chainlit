import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type WatchItem = { id: number; token: string; createdAt: string };

export default function WatchlistCard() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [tok, setTok] = useState("");

  async function load() {
    try {
      const r = await api.get("/v1/watchlist");
      setItems((r.data as any)?.data || []);
    } catch { /* ignore */ }
  }
  async function add() {
    if (!tok.trim()) return;
    setAdding(true);
    try {
      await api.post("/v1/watchlist", { token: tok.trim().toUpperCase() });
      setTok("");
      await load();
    } finally {
      setAdding(false);
    }
  }
  async function remove(token: string) {
    await api.delete(`/v1/watchlist/${encodeURIComponent(token)}`);
    await load();
  }

  useEffect(() => { load(); }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watchlist</CardTitle>
        <CardDescription>Track tokens and power your alerts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="e.g., ETH or SOL"
            value={tok}
            onChange={(e) => setTok(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button onClick={add} disabled={adding || !tok.trim()}>
            {adding ? "Adding…" : "Add"}
          </Button>
        </div>

        <div className="grid gap-2">
          {items.length === 0 && <div className="text-sm text-muted-foreground">No tokens yet.</div>}
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between rounded border p-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{it.token}</Badge>
                <span className="text-xs text-muted-foreground">added {new Date(it.createdAt).toLocaleString()}</span>
              </div>
              <Button variant="destructive" size="sm" onClick={() => remove(it.token)}>Remove</Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
