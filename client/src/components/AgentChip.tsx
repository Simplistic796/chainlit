type Props = { agent: string; stance: "BUY"|"HOLD"|"SELL"|string; confidence: number };

export default function AgentChip({ agent, stance, confidence }: Props) {
  const color =
    stance === "BUY" ? "bg-green-600" :
    stance === "SELL" ? "bg-red-600" : "bg-amber-600";
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{agent.toUpperCase()}</div>
        <span className={`text-xs px-2 py-0.5 rounded text-white ${color}`}>{stance}</span>
      </div>
      <div className="text-xs text-muted-foreground">Confidence {(confidence*100|0)}%</div>
      <div className="h-2 w-full rounded bg-muted overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(0, Math.min(1, confidence))*100}%` }} />
      </div>
    </div>
  );
}
