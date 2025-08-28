import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type AlertRow = {
  id: number;
  token: string;
  type: string;           // "consensus_flip" | "score_threshold" | "risk_change"
  condition: any;
  channel: string;        // "webhook" | "email"
  target: string;         // URL or email
  isActive: boolean;
  createdAt: string;
};

export default function AlertsManager() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [token, setToken] = useState("");
  const [type, setType] = useState<string>("consensus_flip");
  const [target, setTarget] = useState("");
  const [score, setScore] = useState<string>("75");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const r = await api.get("/ui/alerts");
      setAlerts((r.data as any)?.data || []);
    } catch { /* ignore */ }
  }

  async function create() {
    if (!token.trim() || !type || !target.trim()) return;
    setSaving(true);
    try {
      const condition =
        type === "score_threshold" ? { scoreGte: Number(score || 0) } : {};
      await api.post("/ui/alerts", {
        token: token.trim().toUpperCase(),
        type,
        condition,
        channel: "webhook",
        target: target.trim(),
      });
      setToken(""); setTarget("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggle(id: number) {
    await api.patch(`/ui/alerts/${id}/toggle`);
    await load();
  }

  async function remove(id: number) {
    await api.delete(`/ui/alerts/${id}`);
    await load();
  }

  useEffect(() => { load(); }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alerts</CardTitle>
        <CardDescription>Create and manage alert rules</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create form */}
        <div className="grid gap-2 md:grid-cols-4">
          <Input
            placeholder="Token (e.g., ETH)"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Alert type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="consensus_flip">Consensus flip</SelectItem>
              <SelectItem value="score_threshold">Score ≥ threshold</SelectItem>
              <SelectItem value="risk_change">Risk change</SelectItem>
            </SelectContent>
          </Select>
          {type === "score_threshold" ? (
            <Input
              placeholder="Score ≥"
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          ) : (
            <div className="hidden md:block" />
          )}
          <Input
            placeholder="Webhook URL (e.g., https://webhook.site/uuid)"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <div className="md:col-span-4">
            <Button onClick={create} disabled={saving || !token || !target}>
              {saving ? "Saving…" : "Add alert"}
            </Button>
            <span className="ml-3 text-xs text-muted-foreground">
              Tip: use <code>https://webhook.site/</code> to test.
            </span>
          </div>
        </div>

        {/* List */}
        <div className="grid gap-2">
          {alerts.length === 0 && <div className="text-sm text-muted-foreground">No alerts yet.</div>}
          {alerts.map((a) => (
            <div key={a.id} className="flex flex-col md:flex-row md:items-center justify-between gap-2 rounded border p-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{a.token}</Badge>
                <span className="text-xs uppercase">{a.type}</span>
                {a.type === "score_threshold" && (
                  <span className="text-xs text-muted-foreground">
                    score ≥ {(a.condition?.scoreGte ?? "-")}
                  </span>
                )}
                <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                  → {a.channel}:{a.target}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant={a.isActive ? "secondary" : "default"} onClick={() => toggle(a.id)}>
                  {a.isActive ? "Disable" : "Enable"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => remove(a.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
