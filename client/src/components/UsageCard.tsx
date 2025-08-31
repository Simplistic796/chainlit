import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

type UsageData = {
  id: number;
  date: string;
  requests: number;
  ok2xx: number;
  client4xx: number;
  server5xx: number;
  topEndpoints: { endpoint: string; count: number }[];
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
};

export default function UsageCard() {
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(30);

  const fetchUsageData = async (selectedDays: number) => {
    try {
      setLoading(true);
      const response = await axios.get<UsageData[]>(`${API_BASE}/ui/analytics/usage`, {
        params: { days: selectedDays }
      });
      setUsageData(response.data);
    } catch (error) {
      console.error("Failed to fetch usage data:", error);
      setUsageData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageData(days);
  }, [days]);

  const handleDaysChange = (value: string) => {
    const newDays = parseInt(value);
    setDays(newDays);
  };

  // Calculate totals
  const totalRequests = usageData.reduce((sum, day) => sum + day.requests, 0);
  const totalOk2xx = usageData.reduce((sum, day) => sum + day.ok2xx, 0);
  const totalClient4xx = usageData.reduce((sum, day) => sum + day.client4xx, 0);
  const totalServer5xx = usageData.reduce((sum, day) => sum + day.server5xx, 0);

  // Calculate rates
  const ok2xxRate = totalRequests > 0 ? ((totalOk2xx / totalRequests) * 100).toFixed(1) : "0.0";
  const client4xxRate = totalRequests > 0 ? ((totalClient4xx / totalRequests) * 100).toFixed(1) : "0.0";
  const server5xxRate = totalRequests > 0 ? ((totalServer5xx / totalRequests) * 100).toFixed(1) : "0.0";

  // Get top endpoints across all days
  const endpointCounts: Record<string, number> = {};
  usageData.forEach(day => {
    if (day.topEndpoints && day.topEndpoints.length > 0) {
      day.topEndpoints.forEach(ep => {
        endpointCounts[ep.endpoint] = (endpointCounts[ep.endpoint] || 0) + ep.count;
      });
    }
  });

  const topEndpoints = Object.entries(endpointCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([endpoint, count]) => ({ endpoint, count }));

  // Find max requests for chart scaling
  const maxRequests = Math.max(...usageData.map(day => day.requests), 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>API Usage Analytics</CardTitle>
            <CardDescription>Requests, status rates, and top endpoints</CardDescription>
          </div>
          <Select value={days.toString()} onValueChange={handleDaysChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading usage data...</div>
        ) : usageData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No usage data available</div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{totalRequests}</div>
                <div className="text-sm text-muted-foreground">Total Requests</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{ok2xxRate}%</div>
                <div className="text-sm text-muted-foreground">2xx Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{client4xxRate}%</div>
                <div className="text-sm text-muted-foreground">4xx Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{server5xxRate}%</div>
                <div className="text-sm text-muted-foreground">5xx Rate</div>
              </div>
            </div>

            {/* SLO Tiles and CSV Download */}
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Total: {totalRequests}</Badge>
                <Badge variant="secondary">2xx: {(totalOk2xx / totalRequests * 100).toFixed(1)}%</Badge>
                <Badge variant="secondary">
                  p95: {usageData.length > 0 && usageData[usageData.length - 1]?.p95LatencyMs != null
                    ? `${usageData[usageData.length - 1].p95LatencyMs!.toFixed(0)} ms` 
                    : "—"}
                </Badge>
              </div>
              <Button
                variant="secondary"
                onClick={() => window.open(`${API_BASE}/ui/analytics/usage.csv?days=${days}`, "_blank")}
              >
                Download CSV
              </Button>
            </div>

            {/* Status Rate Chips */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200">
                2xx: {ok2xxRate}%
              </Badge>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                4xx: {client4xxRate}%
              </Badge>
              <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-200">
                5xx: {server5xxRate}%
              </Badge>
            </div>

            {/* Mini Bar Chart */}
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-3">Requests per Day</div>
              <div className="flex items-end gap-1 h-32">
                {usageData.map((day) => (
                  <div key={day.id} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-blue-500 rounded-t-sm transition-all duration-200 hover:bg-blue-600"
                      style={{ 
                        height: `${Math.max((day.requests / maxRequests) * 100, 2)}%`,
                        minHeight: '2px'
                      }}
                      title={`${day.date}: ${day.requests} requests`}
                    />
                    <div className="text-xs text-muted-foreground mt-1 transform -rotate-45 origin-left">
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Endpoints */}
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-3">Top Endpoints</div>
              <div className="space-y-2">
                {topEndpoints.map((endpoint, index) => (
                  <div key={endpoint.endpoint} className="flex items-center justify-between p-2 bg-muted rounded-md">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        #{index + 1}
                      </Badge>
                      <span className="font-mono text-sm">{endpoint.endpoint}</span>
                    </div>
                    <Badge variant="secondary">{endpoint.count}</Badge>
                  </div>
                ))}
                {topEndpoints.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    No endpoint data available
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
