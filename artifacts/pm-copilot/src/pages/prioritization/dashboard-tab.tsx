import { useListPrioritization, getListPrioritizationQueryKey, useAnalyzePrioritization } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, BarChart3, CheckCircle2, ArrowRight, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MOSCOW_COLORS: Record<string, string> = {
  must_have: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  should_have: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  could_have: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  wont_have: "bg-slate-500/10 text-slate-600 border-slate-500/20",
};

const MOSCOW_LABELS: Record<string, string> = {
  must_have: "Must Have", should_have: "Should Have",
  could_have: "Could Have", wont_have: "Won't Have",
};

interface Props { onNavigate: (tab: string) => void; }

export default function DashboardTab({ onNavigate }: Props) {
  const { data: items, isLoading } = useListPrioritization({});
  const analyze = useAnalyzePrioritization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const total = items?.length ?? 0;
  const analyzed = items?.filter(i => i.analyzed).length ?? 0;
  const topScore = items?.[0];

  const handleAnalyzeAll = async () => {
    if (!items?.length) return;
    const unanalyzed = items.filter(i => !i.analyzed);
    if (!unanalyzed.length) {
      toast({ title: "All ideas already analyzed." });
      return;
    }
    toast({ title: `Analyzing ${unanalyzed.length} idea${unanalyzed.length > 1 ? "s" : ""}…`, description: "This may take a moment." });
    for (const item of unanalyzed) {
      await new Promise<void>((resolve) =>
        analyze.mutate({ opportunityId: item.opportunity.id }, { onSettled: () => resolve() }),
      );
    }
    queryClient.invalidateQueries({ queryKey: getListPrioritizationQueryKey({}) });
    toast({ title: "Analysis complete", description: `${unanalyzed.length} idea${unanalyzed.length > 1 ? "s" : ""} analyzed.` });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart3 className="size-6 text-primary" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Total Ideas</p>
              {isLoading ? <Skeleton className="h-8 w-12 mt-1" /> : <p className="text-3xl font-bold">{total}</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="size-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="size-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Analyzed</p>
              {isLoading ? <Skeleton className="h-8 w-12 mt-1" /> : (
                <p className="text-3xl font-bold">{analyzed} <span className="text-sm font-normal text-muted-foreground">/ {total}</span></p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="size-12 rounded-xl bg-ai/10 flex items-center justify-center">
              <Brain className="size-6 text-ai" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Top Ranked</p>
              {isLoading ? <Skeleton className="h-5 w-32 mt-1" /> : (
                <p className="text-sm font-semibold truncate max-w-[160px]">{topScore?.opportunity.title ?? "—"}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={handleAnalyzeAll} disabled={analyze.isPending} className="bg-ai text-ai-foreground hover:bg-ai/90 gap-2">
          <Brain className="size-4" />
          {analyze.isPending ? "Analyzing…" : `Analyze Unscored Ideas (${total - analyzed})`}
        </Button>
        <Button variant="outline" className="gap-2" onClick={() => onNavigate("results")}>
          <BarChart3 className="size-4" /> View Full Results
        </Button>
        <Button variant="outline" className="gap-2" onClick={() => onNavigate("executive")}>
          <Zap className="size-4" /> Executive Recommendation
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Top Ranked Product Ideas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4">
                <Skeleton className="size-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            )) : items?.slice(0, 5).map((item, idx) => {
              const moscow = item.moscowCategory;
              return (
                <div key={item.opportunity.id} className="px-6 py-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                  <div className="size-8 rounded-full bg-secondary flex items-center justify-center font-bold text-muted-foreground shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.opportunity.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {item.riceScore?.score != null && (
                        <span className="text-xs text-muted-foreground">RICE {Number(item.riceScore.score).toFixed(1)}</span>
                      )}
                      {item.weightedScore != null && (
                        <span className="text-xs text-muted-foreground">· WS {Number(item.weightedScore).toFixed(1)}</span>
                      )}
                      {moscow && (
                        <Badge variant="outline" className={`text-[10px] ${MOSCOW_COLORS[moscow] ?? ""}`}>
                          {MOSCOW_LABELS[moscow] ?? moscow}
                        </Badge>
                      )}
                      {!item.analyzed && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Not analyzed</Badge>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1 shrink-0" onClick={() => onNavigate("results")}>
                    <ArrowRight className="size-3" />
                  </Button>
                </div>
              );
            })}
            {!isLoading && !items?.length && (
              <div className="px-6 py-12 text-center text-muted-foreground text-sm">
                No Product Ideas found. Add some in Discovery first.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}