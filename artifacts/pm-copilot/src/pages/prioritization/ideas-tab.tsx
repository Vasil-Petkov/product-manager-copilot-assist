import { useListPrioritization, useAnalyzePrioritization, getListPrioritizationQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  under_review: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  ready_for_prioritization: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  archived: "bg-slate-500/10 text-slate-600 border-slate-500/20",
};

const QUADRANT_LABELS: Record<string, { label: string; color: string }> = {
  high_value_low_effort: { label: "Quick Win 🚀", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  high_value_high_effort: { label: "Strategic 🎯", color: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
  low_value_low_effort: { label: "Fill-in 📦", color: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  low_value_high_effort: { label: "Avoid ❌", color: "bg-red-500/10 text-red-700 border-red-500/20" },
};

export default function IdeasTab() {
  const { data: items, isLoading } = useListPrioritization({});
  const analyze = useAnalyzePrioritization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleAnalyze = (opportunityId: number, title: string) => {
    analyze.mutate({ opportunityId }, {
      onSuccess: () => {
        toast({ title: "Analysis complete", description: `"${title}" has been analyzed.` });
        queryClient.invalidateQueries({ queryKey: getListPrioritizationQueryKey({}) });
      },
      onError: () => toast({ title: "Analysis failed", description: "Please try again.", variant: "destructive" }),
    });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-5 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-8 w-24 mt-2" />
          </Card>
        ))}
      </div>
    );
  }

  if (!items?.length) {
    return <div className="text-center py-20 text-muted-foreground">No Product Ideas found. Add some in the Discovery module first.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map((item) => {
        const opp = item.opportunity;
        const quadrant = item.vveQuadrant ? QUADRANT_LABELS[item.vveQuadrant] : null;

        return (
          <Card key={opp.id} className="flex flex-col hover:border-primary/40 transition-colors">
            <CardContent className="p-5 flex flex-col flex-1 gap-3">
              <div className="flex items-start justify-between gap-2">
                <Badge variant="outline" className={`text-xs shrink-0 ${STATUS_COLORS[opp.status ?? "new"] ?? ""}`}>
                  {(opp.status ?? "new").replace(/_/g, " ")}
                </Badge>
                {item.analyzed ? <CheckCircle2 className="size-4 text-emerald-600 shrink-0" /> : <Clock className="size-4 text-muted-foreground/50 shrink-0" />}
              </div>
              <div>
                <p className="font-semibold leading-snug">{opp.title}</p>
                {opp.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{opp.description}</p>}
              </div>
              {item.analyzed && (
                <div className="flex flex-wrap gap-2">
                  {item.riceScore?.score != null && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">RICE {Number(item.riceScore.score).toFixed(1)}</span>}
                  {item.iceScore?.score != null && <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">ICE {Number(item.iceScore.score).toFixed(0)}</span>}
                  {item.opportunityScore != null && <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">OS {Number(item.opportunityScore).toFixed(1)}</span>}
                  {quadrant && <Badge variant="outline" className={`text-[10px] ${quadrant.color}`}>{quadrant.label}</Badge>}
                </div>
              )}
              <div className="mt-auto pt-2">
                <Button size="sm" variant={item.analyzed ? "outline" : "default"} className="w-full gap-2" disabled={analyze.isPending} onClick={() => handleAnalyze(opp.id, opp.title)}>
                  <Brain className="size-3.5" /> {item.analyzed ? "Re-analyze" : "Analyze with AI"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}