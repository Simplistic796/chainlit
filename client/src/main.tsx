import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import App from "./App.tsx";
import Terms from "./pages/Terms.tsx";
import Privacy from "./pages/Privacy.tsx";
import "./index.css";

// Optional Sentry init for client (requires VITE_SENTRY_DSN set in Vercel if you enable)
// import * as Sentry from "@sentry/react";
// Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, tracesSampleRate: 0.1 });

function Shell() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
      </Routes>
      <footer className="text-center text-xs text-muted-foreground my-8">
        <Link to="/terms" className="hover:underline mr-3">Terms</Link>
        <Link to="/privacy" className="hover:underline">Privacy</Link>
      </footer>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><Shell /></StrictMode>
);
