import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetDashboardStats, useGetDailySummary } from "@workspace/api-client-react";
import { Brain, Compass, Users, Map, AlertCircle, BarChart3, MessageSquare } from "lucide-react";
import { HelpTooltip } from "@/components/help-tooltip";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = {
  positive: "hsl(var(--success))",
  neutral: "hsl(var(--muted-foreground))",
  negative: "hsl(var(--destructive))",
  mixed: "hsl(var(--warning))"
};

export default function DiscoveryDashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: summary, isLoading: summaryLoading } = useGetDailySummary();

  const sentimentData = stats?.sentimentBreakdown?.map(item => ({
    name: item.sentiment,
    value: item.count,
    color: COLORS[item.sentiment as keyof typeof COLORS] || COLORS.neutral
  })) || [];

  return (
    <div className="p-8 w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            Discovery Intelligence
            <HelpTooltip
              purpose="Your command center for Product Discovery."
              bullets={[
                "View overall discovery health",
                "Monitor new opportunities",
                "Track insights and sentiment",
                "See key metrics at a glance",
              ]}
            />
          </h1>
          <p className="text-muted-foreground mt-1">Aggregate signals and uncover what to build next.</p>
        </div>
      </header>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Compass className="size-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">New Opportunities</p>
                {statsLoading ? <Skeleton className="h-8 w-16 mt-1" /> : (
                  <h3 className="text-3xl font-bold">{stats?.newOpportunities || 0}</h3>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-lg bg-warning/10 flex items-center justify-center text-warning">
                <Map className="size-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Prioritization</p>
                {statsLoading ? <Skeleton className="h-8 w-16 mt-1" /> : (
                  <h3 className="text-3xl font-bold">{stats?.waitingForPrioritization || 0}</h3>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-ai/5 border-ai/20 shadow-none">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="size-10 rounded-full bg-ai/20 flex items-center justify-center text-ai shrink-0 mt-1">
                <Brain className="size-5" />
              </div>
              <div className="space-y-2 w-full">
                <h4 className="text-sm font-semibold text-ai">Daily Insight</h4>
                {summaryLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-[80%]" />
                  </div>
                ) : (
                  <p className="text-sm text-foreground/80 leading-relaxed line-clamp-3">
                    {summary?.summary || "No insights generated yet."}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Charts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Signal Sentiment</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] flex items-center justify-center">
            {statsLoading ? <Skeleton className="h-48 w-48 rounded-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sentimentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {sentimentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sources Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            {statsLoading ? <Skeleton className="h-full w-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.sourceBreakdown || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="sourceType" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--muted))'}}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Lists */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="size-5 text-muted-foreground" /> 
              Top Customer Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {statsLoading ? <div className="p-4 space-y-3"><Skeleton className="h-8 w-full"/><Skeleton className="h-8 w-full"/></div> : (
              <div className="divide-y">
                {stats?.topRequests.map((req, i) => (
                  <div key={i} className="flex justify-between items-center p-4 hover:bg-muted/50 transition-colors">
                    <span className="font-medium text-sm">{req.label}</span>
                    <span className="text-xs font-mono bg-secondary px-2 py-1 rounded-md">{req.count} signals</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="size-5 text-destructive" /> 
              Top Pain Points
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {statsLoading ? <div className="p-4 space-y-3"><Skeleton className="h-8 w-full"/><Skeleton className="h-8 w-full"/></div> : (
              <div className="divide-y">
                {stats?.topPainPoints.map((pp, i) => (
                  <div key={i} className="flex justify-between items-center p-4 hover:bg-muted/50 transition-colors">
                    <span className="font-medium text-sm">{pp.label}</span>
                    <span className="text-xs font-mono bg-destructive/10 text-destructive px-2 py-1 rounded-md">{pp.count} signals</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
