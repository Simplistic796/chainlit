import { useEffect, useState } from "react";
import axios from "axios";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const API_BASE = import.meta.env.VITE_API_BASE;

type PortfolioPnLData = {
  windowDays: number;
  dates: string[];
  portfolio: number[];
  btc: number[];
  eth: number[];
  summary: {
    cum: number;
    mean: number;
    stdev: number;
    sharpeDaily: number;
    maxDD: number;
    alphaBTC: number;
    betaBTC: number;
    alphaETH: number;
    betaETH: number;
  };
};

// Simple SVG sparkline component
function Sparkline({ data, color, height = 40, width = 200 }: { 
  data: number[]; 
  color: string; 
  height?: number; 
  width?: number; 
}) {
  if (data.length < 2) return <div className="text-muted-foreground text-sm">Insufficient data</div>;

  // Convert returns to cumulative values for better visualization
  const cumulative = data.reduce((acc, ret) => {
    acc.push(acc[acc.length - 1] * (1 + ret));
    return acc;
  }, [1]);

  // Find min/max for scaling
  const min = Math.min(...cumulative);
  const max = Math.max(...cumulative);
  const range = max - min || 1;

  // Generate SVG path
  const points = cumulative.map((value, index) => {
    const x = (index / (cumulative.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function PortfolioPerformance() {
  const [data, setData] = useState<PortfolioPnLData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState(30);

  async function loadPerformance(days: number) {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get<{ ok: boolean; data: PortfolioPnLData }>(`${API_BASE}/ui/portfolio/pnl`, {
        params: { days }
      });
      setData(response.data?.data || null);
    } catch (error) {
      console.error('Failed to load portfolio performance:', error);
      setError('Failed to load performance data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV() {
    if (!data) return;
    
    const days = selectedDays;
    window.open(`${API_BASE}/ui/portfolio/pnl.csv?days=${days}`, "_blank");
  }

  useEffect(() => {
    loadPerformance(selectedDays);
  }, [selectedDays]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Performance</CardTitle>
          <CardDescription>Loading performance data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground text-center py-8">Loading performance...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Performance</CardTitle>
          <CardDescription>Error loading performance data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-red-600 text-center py-8">{error}</div>
          <div className="flex justify-center">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => loadPerformance(selectedDays)}
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.dates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Performance</CardTitle>
          <CardDescription>Add some holdings to see performance data</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
  const formatNumber = (value: number) => value.toFixed(4);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Portfolio Performance
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={downloadCSV}
              disabled={!data || loading}
            >
              Download CSV
            </Button>
            <span className="text-sm text-muted-foreground">Window:</span>
            <Tabs value={selectedDays.toString()} onValueChange={(v) => setSelectedDays(Number(v))}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="30">30d</TabsTrigger>
                <TabsTrigger value="90">90d</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardTitle>
        <CardDescription>
          Performance vs BTC/ETH benchmarks over {data.windowDays} days
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Performance Charts */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm font-medium">Portfolio</span>
            </div>
            <Sparkline data={data.portfolio} color="#3b82f6" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span className="text-sm font-medium">BTC</span>
            </div>
            <Sparkline data={data.btc} color="#f97316" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span className="text-sm font-medium">ETH</span>
            </div>
            <Sparkline data={data.eth} color="#a855f7" />
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="grid gap-3 md:grid-cols-5">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {formatPercent(data.summary.cum)}
            </div>
            <div className="text-xs text-muted-foreground">Cum Return</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold">
              {formatPercent(data.summary.mean)}
            </div>
            <div className="text-xs text-muted-foreground">Daily Mean</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold">
              {formatPercent(data.summary.stdev)}
            </div>
            <div className="text-xs text-muted-foreground">Daily StDev</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold">
              {formatNumber(data.summary.sharpeDaily)}
            </div>
            <div className="text-xs text-muted-foreground">Sharpe (Daily)</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {formatPercent(data.summary.maxDD)}
            </div>
            <div className="text-xs text-muted-foreground">Max Drawdown</div>
          </div>
        </div>

        {/* Alpha/Beta Metrics */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Risk-Adjusted Metrics vs Benchmarks</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded border p-2 text-xs">
              <div className="text-muted-foreground">Alpha vs BTC</div>
              <div className="font-medium">{(data.summary.alphaBTC * 100).toFixed(2)}%</div>
            </div>
            <div className="rounded border p-2 text-xs">
              <div className="text-muted-foreground">Beta vs BTC</div>
              <div className="font-medium">{data.summary.betaBTC.toFixed(2)}</div>
            </div>
            <div className="rounded border p-2 text-xs">
              <div className="text-muted-foreground">Alpha vs ETH</div>
              <div className="font-medium">{(data.summary.alphaETH * 100).toFixed(2)}%</div>
            </div>
            <div className="rounded border p-2 text-xs">
              <div className="text-muted-foreground">Beta vs ETH</div>
              <div className="font-medium">{data.summary.betaETH.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Performance Comparison */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Performance vs Benchmarks</h4>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <span className="text-sm">vs BTC</span>
              <Badge variant={data.summary.cum > data.btc.reduce((acc, r) => acc * (1 + r), 1) - 1 ? "default" : "secondary"}>
                {data.summary.cum > data.btc.reduce((acc, r) => acc * (1 + r), 1) - 1 ? "Outperforming" : "Underperforming"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <span className="text-sm">vs ETH</span>
              <Badge variant={data.summary.cum > data.eth.reduce((acc, r) => acc * (1 + r), 1) - 1 ? "default" : "secondary"}>
                {data.summary.cum > data.eth.reduce((acc, r) => acc * (1 + r), 1) - 1 ? "Outperforming" : "Underperforming"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="flex justify-center">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => loadPerformance(selectedDays)}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh Data"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
