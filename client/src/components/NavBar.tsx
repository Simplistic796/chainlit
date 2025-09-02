import { Link } from "react-router-dom";
import AccountBadge from "@/components/AccountBadge";

export default function NavBar() {
  return (
    <nav className="flex items-center justify-between p-4 border-b">
      <Link to="/" className="font-bold text-xl">ChainLit</Link>
      <div className="flex items-center gap-4">
        <Link to="/pricing" className="text-sm font-medium hover:underline">Pricing</Link>
        <a href={`${import.meta.env.VITE_API_BASE}/docs`} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">API Docs</a>
        <AccountBadge />
      </div>
    </nav>
  );
}
