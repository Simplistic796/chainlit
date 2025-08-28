import { Link } from "react-router-dom";
import AccountBadge from "@/components/AccountBadge";

export default function NavBar() {
  return (
    <nav className="flex items-center justify-between p-4 border-b">
      <Link to="/" className="font-bold text-xl">ChainLit</Link>
      <div className="flex items-center gap-4">
        <Link to="/pricing" className="text-sm font-medium hover:underline">Pricing</Link>
        <AccountBadge />
      </div>
    </nav>
  );
}
