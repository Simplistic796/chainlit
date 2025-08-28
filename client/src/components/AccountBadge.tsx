import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function AccountBadge() {
  const [plan, setPlan] = useState<string>("…");

  useEffect(() => {
    axios.get(`${API_BASE}/ui/account`).then((r: any) => {
      setPlan(r.data?.data?.plan || "free");
    }).catch(() => setPlan("free"));
  }, []);

  return (
    <div className="text-xs rounded border px-2 py-1">
      Plan: <span className="font-medium uppercase">{plan}</span>
    </div>
  );
}
