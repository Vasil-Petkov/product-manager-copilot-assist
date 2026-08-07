import { useListInsights, useGetTrendingInsights, useGenerateInsights, getListInsightsQueryKey, getGetTrendingInsightsQueryKey, useGetDailySummary } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, TrendingUp, AlertTriangle, Target, Lightbulb, Activity, ArrowRight, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const TYPE_CONFIG = {
  trending_problem: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10 border-destructive/20" },
  emerging_request: { icon: Lightbulb, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
  competitor_trend: { icon: Target, color: "text-warning", bg: "bg-warning/10 border-warning/20" },
  market_opportunity: { icon: TrendingUp, color: "text-success", bg: "bg-success/10 border-success/20" },
  innovation: { icon: Brain, color: "text-ai", bg: "bg-ai/10 border-ai/20" },
  stakeholder_concern: { icon: ShieldAlert, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" }
};

export default function AiInsights() {
  const { data: insights, isLoading: insightsLoading } = useListInsights();
  const { data: trending, isLoading: trendingLoading } = useGetTrendingInsights();
  const { data: summary } = useGetDailySummary();
  
  const generate = useGenerateInsights();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleGenerate = () => {
    generate.mutate({}, {
      onSuccess: () => {
        toast({ title: "Insights generated", description: "AI has processed new signals." });
        queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTrendingInsightsQueryKey() });
      }
    });
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full space-y-8 animate-in fade-in">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="size-8 text-ai" />
            AI Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">Cross-signal synthesis and emerging trends.</p>
        </div>
        <Button onClick={handleGenerate} disabled={generate.isPending} className="bg-ai text-ai-foreground hover:bg-ai/90 shrink-0 gap-2 shadow-sm">
          <Activity className="size-4" /> {generate.isPending ? "Synthesizing Data..." : "Generate Insights"}
        </Button>
      </header>

      {summary && (
        <Card className="bg-ai/5 border-ai/20 shadow-none">
          <CardContent className="p-6 flex gap-6">
            <div className="size-12 rounded-full bg-ai/20 flex items-center justify-center text-ai shrink-0">
              <Brain className="size-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-ai">Daily Synthesis</h3>
              <p className="text-foreground/90 leading-relaxed max-w-4xl">{summary.summary}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-semibold tracking-tight">Discovered Insights</h2>
          
          {insightsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : (!insights || insights.length === 0) ? (
            <div className="text-center py-20 text-muted-foreground border border-dashed rounded-lg bg-card">
              No insights generated yet. Click generate to process signals.
            </div>
          ) : (
            <div className="space-y-4">
              {insights.map(insight => {
                const config = TYPE_CONFIG[insight.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.innovation;
                const Icon = config.icon;
                
                return (
                  <Card key={insight.id} className="hover:border-primary/30 transition-colors">
                    <CardHeader className="p-5 pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className={`${config.bg} ${config.color} border gap-1.5 py-1`}>
                          <Icon className="size-3" />
                          {insight.type.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{format(new Date(insight.createdAt), 'MMM d')}</span>
                      </div>
                      <CardTitle className="text-lg leading-snug">{insight.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 pt-2">
                      <p className="text-sm text-foreground/80 leading-relaxed">{insight.content}</p>
                      
                      {insight.relatedOpportunityIds && insight.relatedOpportunityIds.length > 0 && (
                        <div className="mt-4 pt-4 border-t flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Linked to {insight.relatedOpportunityIds.length} opportunities</span>
                          <Button variant="link" size="sm" className="h-auto p-0 text-xs ml-auto text-primary">
                            View <ArrowRight className="size-3 ml-1" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-semibold tracking-tight">Trending Topics</h2>
          
          {trendingLoading ? (
            <Skeleton className="h-[600px] w-full" />
          ) : trending ? (
            <div className="space-y-6">
              <TrendCard title="Top Problems" items={trending.topProblems} colorClass="bg-destructive" />
              <TrendCard title="Emerging Requests" items={trending.emergingRequests} colorClass="bg-primary" />
              <TrendCard title="Fastest Growing" items={trending.fastestGrowingThemes} colorClass="bg-success" />
              {trending.competitorTrends && trending.competitorTrends.length > 0 && (
                <TrendCard title="Competitor Trends" items={trending.competitorTrends} colorClass="bg-warning" />
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TrendCard({ title, items, colorClass }: any) {
  if (!items || items.length === 0) return null;
  
  return (
    <Card>
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {items.map((item: any, i: number) => (
            <div key={i} className="p-4 hover:bg-muted/30 transition-colors">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-sm line-clamp-1 flex-1 pr-4">{item.label}</span>
                <span className="text-xs font-mono font-semibold">{Math.round(item.score)}</span>
              </div>
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <div className={`h-full ${colorClass}`} style={{ width: `${Math.min(100, item.score)}%` }} />
              </div>
              {item.trend && (
                <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                  <TrendingUp className="size-3" /> {item.trend}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
