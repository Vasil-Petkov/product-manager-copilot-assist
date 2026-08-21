import { useGetExecutiveRecommendation, useListPrioritization } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, BarChart3, Brain, DollarSign, Target, TrendingUp, Trophy, Users, Wrench } from "lucide-react";

interface Props {
  onNavigate: (tab: string) => void;
}

function Insight({ icon: Icon, label, value, color = "text-foreground" }: { icon: typeof TrendingUp; label: string; value: string; color?: string }) {
  return (
    <div className="p-4 rounded-lg border bg-card space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide"><Icon className="size-3.5" />{label}</div>
      <p className={`text-sm leading-snug ${color}`}>{value}</p>
    </div>
  );
}

export default function ExecutiveTab({ onNavigate }: Props) {
  const { data: recommendation, isLoading: recommendationLoading } = useGetExecutiveRecommendation();
  const { isLoading: listLoading } = useListPrioritization({});
  const top = recommendation?.topRecommendation as any;
  const executive = top?.analysis?.executiveData as Record<string, any> | null;
  const engineering = top?.analysis?.engineeringData as Record<string, any> | null;

  if (recommendationLoading || listLoading) {
    return <div className="space-y-6"><Skeleton className="h-48 w-full" /><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24" />)}</div></div>;
  }

  if (!recommendation?.totalAnalyzed) {
    return (
      <Card className="bg-ai/5 border-ai/20">
        <CardContent className="p-12 flex flex-col items-center gap-4 text-center">
          <Brain className="size-12 text-ai/50" />
          <div><p className="font-semibold text-lg">No analyses yet</p><p className="text-muted-foreground text-sm mt-1">Analyze your Product Ideas first to generate an Executive Recommendation.</p></div>
          <Button onClick={() => onNavigate("ideas")} className="gap-2"><BarChart3 className="size-4" />Go to Product Ideas</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {top && executive && (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-ai/10 via-primary/5 to-transparent p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
              <div className="shrink-0 text-center">
                <div className={`text-6xl font-black tabular-nums ${executive.score >= 70 ? "text-emerald-600" : executive.score >= 40 ? "text-amber-600" : "text-destructive"}`}>{Math.round(executive.score ?? 0)}</div>
                <p className="text-xs text-muted-foreground">/ 100 Priority Score</p>
                <Badge variant="outline" className="mt-2 text-xs">AI Confidence {executive.confidence ?? 0}%</Badge>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2"><Trophy className="size-5 text-amber-500" /><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top Recommendation</span></div>
                <h2 className="text-2xl font-bold tracking-tight mb-3">{top.opportunity?.title}</h2>
                <p className="text-muted-foreground leading-relaxed">{executive.whyBuildNext}</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {top && executive && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Insight icon={TrendingUp} label="Business Impact" value={executive.businessImpact ?? "—"} color="text-emerald-700" />
          <Insight icon={Users} label="Customer Impact" value={executive.customerImpact ?? "—"} color="text-blue-700" />
          <Insight icon={Wrench} label="Engineering Investment" value={executive.engineering ?? "—"} />
          <Insight icon={DollarSign} label="Expected ROI" value={executive.expectedROI ?? "—"} color="text-emerald-700" />
        </div>
      )}

      {executive?.risks && (
        <Card className="border-destructive/20 bg-destructive/5"><CardContent className="p-5 flex items-start gap-3"><AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" /><div><p className="font-medium text-sm mb-1">Risks to consider</p><p className="text-sm text-muted-foreground">{executive.risks}</p></div></CardContent></Card>
      )}

      {engineering && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Wrench className="size-4" />Engineering Estimate</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mb-4">
              {[["Frontend", engineering.frontend], ["Backend", engineering.backend], ["Database", engineering.database], ["API", engineering.api], ["AI/ML", engineering.ai], ["QA", engineering.qa]].map(([label, value]) => (
                <div key={String(label)} className="text-center p-3 rounded-lg bg-muted/50"><p className="text-2xl font-bold tabular-nums">{String(value ?? "—")}</p><p className="text-xs text-muted-foreground mt-0.5">{label} SP</p></div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground border-t pt-4"><span><strong className="text-foreground">{engineering.totalStoryPoints ?? "—"}</strong> total story points</span><span><strong className="text-foreground">{engineering.estimatedDays ?? "—"}</strong> estimated days</span><span><strong className="text-foreground">{engineering.sprintCount ?? "—"}</strong> sprints</span></div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Target className="size-4" />All Analyzed Ideas by Priority Score</CardTitle></CardHeader>
        <CardContent className="p-0"><div className="divide-y divide-border">
          {(recommendation?.allRanked as any[])?.map((entry, index) => {
            const data = entry.analysis?.executiveData;
            return <div key={entry.opportunity?.id ?? index} className="px-6 py-4 flex items-center gap-4"><div className="size-8 rounded-full bg-secondary flex items-center justify-center font-bold text-muted-foreground text-sm shrink-0">{index + 1}</div><div className="flex-1 min-w-0"><p className="font-medium truncate">{entry.opportunity?.title}</p>{data?.whyBuildNext && <p className="text-xs text-muted-foreground truncate mt-0.5">{data.whyBuildNext}</p>}</div><div className="text-2xl font-black tabular-nums shrink-0">{Math.round(data?.score ?? 0)}</div></div>;
          })}
        </div></CardContent>
      </Card>
    </div>
  );
}