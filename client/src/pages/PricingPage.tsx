import SubscribeCard from "@/components/SubscribeCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function PricingPage() {
  return (
    <div className="container mx-auto py-10 space-y-8">
      <h1 className="text-3xl font-bold text-center">Pricing</h1>
      <p className="text-center text-muted-foreground max-w-xl mx-auto">
        Choose the plan that fits your needs. Upgrade anytime.
      </p>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Free */}
        <Card>
          <CardHeader>
            <CardTitle>Free</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-4xl font-bold">$0</p>
            <ul className="list-disc ml-4 text-sm space-y-1">
              <li>Basic token lookups</li>
              <li>Consensus summary</li>
              <li>Limited watchlist</li>
            </ul>
          </CardContent>
        </Card>

        {/* Pro */}
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Pro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-4xl font-bold">$29<span className="text-lg font-normal">/mo</span></p>
            <ul className="list-disc ml-4 text-sm space-y-1">
              <li>Advanced analytics</li>
              <li>Whale + sentiment alerts</li>
              <li>Portfolio dashboard</li>
              <li>Higher API limits</li>
            </ul>
            <SubscribeCard /> {/* reuse checkout button */}
          </CardContent>
        </Card>

        {/* Enterprise */}
        <Card>
          <CardHeader>
            <CardTitle>Enterprise</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-4xl font-bold">Custom</p>
            <ul className="list-disc ml-4 text-sm space-y-1">
              <li>Institutional API access</li>
              <li>Dedicated support</li>
              <li>Custom integrations</li>
            </ul>
            <a
              href="mailto:sales@chainlit.com"
              className="block bg-primary text-white rounded py-2 px-4 text-center font-medium"
            >
              Contact Sales
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
