export default function MiniBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="h-2 w-full rounded bg-muted overflow-hidden">
      <div className="h-full bg-foreground" style={{ width: `${v * 100}%` }} />
    </div>
  );
}
