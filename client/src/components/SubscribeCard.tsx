import { useState } from "react";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SubscribeCard() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function checkout() {
    if (!email) return;
    setLoading(true);
    try {
      const r = await api.post("/v1/checkout", { email });
      const url = (r.data as any)?.data?.url as string | undefined;
      if (url) window.location.href = url;
    } catch (e) {
      alert("Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upgrade to Pro</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && checkout()}
        />
        <Button onClick={checkout} disabled={loading || !email}>
          {loading ? "Redirecting…" : "Subscribe $29/mo"}
        </Button>
      </CardContent>
    </Card>
  );
}


