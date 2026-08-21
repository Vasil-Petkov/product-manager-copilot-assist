import { useGetExecutiveRecommendation, useListPrioritization } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Trophy, TrendingUp, Users, Wrench, AlertTriangle, DollarSign, Target, BarChart3 } from "lucide-react";

interface Props { onNavigate: (tab: string) => void; }

function ScoreRing({ score, confidence }: { score: number; confidence: number }) {
  const color = score >= 70 ? "text-emerald-600" : score >= 40 ? "text-amber-600" : "text-destructive";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`text-6xl font-black tabular-nums ${color}`}>{Math.round(score)}</div>
      <div className="text-xs text-muted-foreground">/ 100 Priority Score</div>
      <Badge variant="outline" className="mt-1 text-xs">AI Confidence {confidence}%</Badge>
    </div>
  );
}

function InsightCard({ icon: Icon, label, value, color = "text-foreground" }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="p-4 rounded-lg border bg-card space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
        <Icon className="size-3.5" /> {label}
      </div>
      <p className={`text-sm leading-snug ${color}`}>{value}</p>
    </div>
  );
}

export default function ExecutiveTab({ onNavigate }: Props) {
  const { data: execData, isLoading: execLoading } = useGetExecutiveRecommendation();
  const { data: allItems, isLoading: listLoading } = useListPrioritization({});

  const isLoading = execLoading || listLoading;
  const totalAnalyzed = execData?.totalAnalyzed ?? 0;
  const top = execData?.topRecommendation as any;
  const exec = top?.analysis?.executiveData as Record<string, any> | null;
  const eng = top?.analysis?.engineeringData as Record<string, any> | null;
  const biz = top?.analysis?.businessContext as Record<string, any> | null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (!totalAnalyzed) {
    return (
      <Card className="bg-ai/5 border-ai/20">
        <CardContent className="p-12 flex flex-col items-center gap-4 text-center">
          <Brain className="size-12 text-ai/50" />
          <div>
            <p className="font-semibold text-lg">No analyses yet</p>
            <p className="text-muted-foreground text-sm mt-1">
              Analyze your Product Ideas first to generate an Executive Recommendation.
            </p>
          </div>
          <Button onClick={() => onNavigate("ideas")} className="gap-2">
            <BarChart3 className="size-4" /> Go to Product Ideas
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero card */}
      {top && exec && (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-ai/10 via-primary/5 to-transparent p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
              {/* Score */}
              <div className="shrink-0">
                <ScoreRing score={exec.score ?? 0} confidence={exec.confidence ?? 0} />
              </div>
              {/* Main content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="size-5 text-amber-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top Recommendation</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight mb-3">{top.opportunity?.title}</h2>
                <p className="text-muted-foreground leading-relaxed">{exec.whyBuildNext}</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Insight cards */}
      {top && exec && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <InsightCard icon={TrendingUp} label="Business Impact"  value={exec.businessImpact ?? "—"} color="text-emerald-700" />
          <InsightCard icon={Users}      label="Customer Impact"  value={exec.customerImpact ?? "—"} color="text-blue-700" />
          <InsightCard icon={Wrench}     label="Eng. Investment"  value={exec.engineering ?? "—"} />
          <InsightCard icon={DollarSign} label="Expected ROI"     value={exec.expectedROI ?? "—"} color="text-emerald-700" />
        </div>
      )}

      {top && exec?.risks && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-5 flex items-start gap-3">
            <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm mb-1">Risks to consider</p>
              <p className="text-sm text-muted-foreground">{exec.risks}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Engineering breakdown */}
      {eng && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Wrench className="size-4" /> Engineering Estimate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mb-4">
              {[
                { label: "Frontend",  val: eng.frontend },
                { label: "Backend",   val: eng.backend },
                { label: "Database",  val: eng.database },
                { label: "API",       val: eng.api },
                { label: "AI/ML",     val: eng.ai },
                { label: "QA",        val: eng.qa },
              ].map(({ label, val }) => (
                <div key={label} className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold tabular-nums">{val ?? "—"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label} SP</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground border-t pt-4">
              <span><strong className="text-foreground">{eng.totalStoryPoints ?? "—"}</strong> total story points</span>
              <span><strong className="text-foreground">{eng.estimatedDays ?? "—"}</strong> estimated days</span>
              <span><strong className="text-foreground">{eng.sprintCount ?? "—"}</strong> sprint{eng.sprintCount !== 1 ? "s" : ""}</span>
              <span>Complexity: <strong className="text-foreground">{eng.complexity ?? "—"}</strong></span>
              <span>Confidence: <strong className="text-foreground">{eng.confidence ?? "—"}%</strong></span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full ranking */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="size-4" /> All Analyzed Ideas by Priority Score
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {(execData?.allRanked as any[])?.map((entry: any, i: number) => {
              const ed = entry.analysis?.executiveData as Record<string, any> | null;
              const score = ed?.score ?? 0;
              const color = score >= 70 ? "text-emerald-600" : score >= 40 ? "text-amber-600" : "text-destructive";
              return (
                <div key={entry.opportunity?.id ?? i} className="px-6 py-4 flex items-center gap-4">
                  <div className="size-8 rounded-full bg-secondary flex items-center justify-center font-bold text-muted-foreground text-sm shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{entry.opportunity?.title}</p>
                    {ed?.whyBuildNext && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{ed.whyBuildNext}</p>
                    )}
                  </div>
                  <div className={`text-2xl font-black tabular-nums shrink-0 ${color}`}>{Math.round(score)}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
