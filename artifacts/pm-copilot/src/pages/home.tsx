import { Brain, ArrowRight, ShieldAlert, Sparkles, TrendingUp, Users, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGetDashboardStats, useGetDailySummary, useListOpportunities } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: summary, isLoading: summaryLoading } = useGetDailySummary();
  const { data: opps, isLoading: oppsLoading } = useListOpportunities({ status: "new" });

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-500">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Good morning, PM</h1>
        <p className="text-muted-foreground">Here is what's happening with your product today.</p>
      </header>

      {/* Top AI Summary */}
      <Card className="border-primary/20 shadow-sm bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-primary text-lg">
            <Brain className="size-5" />
            Daily AI Briefing
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[90%]" />
              <Skeleton className="h-4 w-[80%]" />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-foreground leading-relaxed">{summary?.summary}</p>
              
              {summary?.urgentItems && summary.urgentItems.length > 0 && (
                <div className="flex gap-2 bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                  <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block mb-1">Attention Required</span>
                    <ul className="list-disc list-inside pl-4 space-y-1">
                      {summary.urgentItems.map((item: string | { id: number; title: string; urgency: string; status: string }, i: number) => (
                        <li key={i}>{typeof item === "string" ? item : item.title}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Product Ideas", value: stats?.totalOpportunities, icon: Sparkles },
          { label: "New Signals", value: stats?.totalSignals, icon: Users },
          { label: "Competitors Tracked", value: stats?.totalCompetitors, icon: TrendingUp },
          { label: "Meetings Analyzed", value: stats?.totalMeetings, icon: CheckCircle2 },
        ].map((kpi, i) => (
          <Card key={i}>
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{kpi.value || 0}</p>
                )}
              </div>
              <div className="size-10 bg-secondary rounded-full flex items-center justify-center text-muted-foreground">
                <kpi.icon className="size-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Product Ideas Panel */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Recent Product Ideas</h2>
          <Button variant="outline" asChild size="sm">
            <Link href="/discovery/opportunities">
              View All <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
        
        {oppsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i}><CardContent className="p-6 h-32"><Skeleton className="h-full w-full" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {opps?.slice(0, 3).map((opp) => (
              <Card key={opp.id} className="hover:border-primary/50 transition-colors group flex flex-col cursor-pointer">
                <Link href={`/discovery/opportunities/${opp.id}`}>
                  <CardHeader className="p-5 pb-3">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="outline" className="font-mono text-xs">{opp.sourceType}</Badge>
                      {opp.confidenceScore && (
                        <Badge variant="secondary" className="bg-ai/10 text-ai border-0">
                          {Math.round(opp.confidenceScore * 100)}% Match
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base leading-snug group-hover:text-primary transition-colors line-clamp-2">
                      {opp.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 mt-auto">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {opp.description}
                    </p>
                  </CardContent>
                </Link>
              </Card>
            ))}
            {(!opps || opps.length === 0) && (
              <div className="col-span-full py-12 text-center border rounded-lg bg-card text-muted-foreground border-dashed">
                No Product Ideas yet. Add one from the Product Ideas page or analyze a meeting transcript.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
