export default function Privacy() {
  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-xl font-semibold">Privacy Policy</h1>
      <p>We store recent lookups to improve the product. We do not sell personal data.</p>
      <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
        <li>Analytics may be used to understand usage patterns.</li>
        <li>Third-party APIs are called from the backend; keys are not exposed to the browser.</li>
      </ul>
      <p className="text-xs text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
    </div>
  );
}
