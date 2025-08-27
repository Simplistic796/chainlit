export default function Terms() {
  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-xl font-semibold">Terms of Service</h1>
      <p>ChainLit provides informational analytics only and is not financial advice. Use at your own risk.</p>
      <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
        <li>No warranties; service provided "as is".</li>
        <li>You are responsible for compliance with your local laws.</li>
        <li>We may change or discontinue features at any time.</li>
      </ul>
      <p className="text-xs text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
    </div>
  );
}
