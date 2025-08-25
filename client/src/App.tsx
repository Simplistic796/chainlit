import { useEffect, useState } from "react";
import axios from "axios";

type AnalysisResult = {
  token: string;
  score: number;
  risk: string;
  outlook: string;
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

// Top of file (or near imports)
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";


export default function App() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const fetchRecent = async () => {
    try {
      setLoadingRecent(true);
      const res = await axios.get<RecentRow[]>(`${API_BASE}/recent`);
      setRecent(res.data);
    } catch (e) {
      // don’t block UI if recent fails
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    fetchRecent();
  }, []);

  const analyze = async (overrideToken?: string) => {
    const queryToken = (overrideToken ?? token).trim();
    if (!queryToken) return;

    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await axios.get<AnalysisResult>(`${API_BASE}/analyze`, {
        params: { token: queryToken },
      });
      setResult(res.data);
      setToken(queryToken);
      // refresh recent after a successful analysis
      fetchRecent();
    } catch (err) {
      setError("Something went wrong. Make sure the backend is running on :3000.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "Inter, system-ui, sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>ChainLit MVP</h1>
      <p style={{ color: "#666", marginTop: 4 }}>Enter a token symbol or address to get an explainable score.</p>

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="e.g., ETH or 0x123..."
          style={{ padding: "0.6rem 0.8rem", flex: 1, border: "1px solid #ddd", borderRadius: 8 }}
        />
        <button
          onClick={() => analyze()}
          disabled={!token || loading}
          style={{ padding: "0.6rem 1rem", borderRadius: 8, border: "1px solid #222", cursor: loading ? "default" : "pointer" }}
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </div>

      {error && <p style={{ color: "#c00", marginTop: "1rem" }}>{error}</p>}

      {result && (
        <div style={{ marginTop: "1.5rem", padding: "1rem", border: "1px solid #eee", borderRadius: 12 }}>
          <h2 style={{ marginTop: 0 }}>Result for {result.token}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
            <div><strong>Score</strong><div style={{ fontSize: 24 }}>{result.score}/100</div></div>
            <div><strong>Risk</strong><div style={{ fontSize: 24 }}>{result.risk}</div></div>
            <div><strong>Outlook</strong><div style={{ fontSize: 24 }}>{result.outlook}</div></div>
          </div>

          <h3 style={{ marginTop: "1rem" }}>Evidence</h3>
          <ul>
            {result.evidence.map((ev, i) => (
              <li key={i}>{ev}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: "2rem" }}>
        <h3 style={{ marginBottom: 8 }}>Recent searches</h3>
        {loadingRecent && <p>Loading recent…</p>}
        {!loadingRecent && recent.length === 0 && <p>No recent searches yet — try analyzing a token.</p>}
        {!loadingRecent && recent.length > 0 && (
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {recent.map((row) => (
              <button
                key={row.id}
                onClick={() => analyze(row.token)}
                style={{
                  textAlign: "left",
                  padding: "0.75rem 1rem",
                  border: "1px solid #eee",
                  borderRadius: 10,
                  cursor: "pointer",
                  background: "#fff"
                }}
                title="Click to re-run analysis"
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{row.token}</strong>
                  <span>{new Date(row.createdAt).toLocaleString()}</span>
                </div>
                <div style={{ color: "#555", marginTop: 4 }}>
                  Score <strong>{row.score}</strong> • Risk <strong>{row.risk}</strong> • Outlook <strong>{row.outlook}</strong>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
