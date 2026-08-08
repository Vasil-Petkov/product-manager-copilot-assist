import { useState } from "react";
import { useListPrioritization, useCompareFeatures } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, GitCompare, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MOSCOW_LABELS: Record<string, string> = {
  must_have: "Must Have", should_have: "Should Have",
  could_have: "Could Have", wont_have: "Won't Have",
};
const QUADRANT_LABELS: Record<string, string> = {
  high_value_low_effort: "Quick Win 🚀", high_value_high_effort: "Strategic 🎯",
  low_value_low_effort: "Fill-in 📦", low_value_high_effort: "Avoid ❌",
};

function CompareCell({ a, b }: { a: React.ReactNode; b: React.ReactNode }) {
  return (
    <>
      <td className="px-4 py-3 text-center font-mono text-sm border-r">{a ?? "—"}</td>
      <td className="px-4 py-3 text-center font-mono text-sm">{b ?? "—"}</td>
    </>
  );
}
function SectionRow({ label, cols = 3 }: { label: string; cols?: number }) {
  return (
    <tr className="bg-muted/50">
      <td colSpan={cols} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </td>
    </tr>
  );
}

export default function CompareTab() {
  const { data: items, isLoading: listLoading } = useListPrioritization({});
  const compare = useCompareFeatures();
  const { toast } = useToast();

  const [idA, setIdA] = useState<number | null>(null);
  const [idB, setIdB] = useState<number | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleCompare = () => {
    if (!idA || !idB) { toast({ title: "Select two different ideas to compare.", variant: "destructive" }); return; }
    if (idA === idB) { toast({ title: "Please select two different ideas.", variant: "destructive" }); return; }
    compare.mutate(
      { data: { idA, idB } },
      {
        onSuccess: (data) => setResult(data),
        onError: () => toast({ title: "Comparison failed", description: "Please try again.", variant: "destructive" }),
      }
    );
  };

  if (listLoading) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  const options = items ?? [];
  const selA = options.find(i => i.opportunity.id === idA);
  const selB = options.find(i => i.opportunity.id === idB);

  const getA = (field: string) => result?.analysisA?.[field];
  const getB = (field: string) => result?.analysisB?.[field];
  const getAj = (field: string, key: string) => result?.analysisA?.[field]?.[key];
  const getBj = (field: string, key: string) => result?.analysisB?.[field]?.[key];

  return (
    <div className="space-y-6">
      {/* Selector */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {[
              { label: "Feature A", val: idA, set: setIdA, exclude: idB },
              { label: "Feature B", val: idB, set: setIdB, exclude: idA },
            ].map(({ label, val, set, exclude }) => (
              <div key={label}>
                <p className="text-sm font-medium mb-1.5">{label}</p>
                <select
                  value={val ?? ""}
                  onChange={(e) => set(Number(e.target.value) || null)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select a product idea…</option>
                  {options.map(i => (
                    <option key={i.opportunity.id} value={i.opportunity.id} disabled={i.opportunity.id === exclude}>
                      {i.opportunity.title}{!i.analyzed ? " (not analyzed)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <Button onClick={handleCompare} disabled={compare.isPending || !idA || !idB} className="gap-2">
            <GitCompare className="size-4" />
            {compare.isPending ? "Comparing…" : "Compare with AI"}
          </Button>
          {(!selA?.analyzed || !selB?.analyzed) && idA && idB && (
            <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
              <AlertTriangle className="size-3" /> One or both ideas haven't been analyzed yet. Results may be limited.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Comparison table */}
      {result && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-secondary/50">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground w-48">Criterion</th>
                  <th className="px-4 py-4 text-center text-sm font-bold border-r max-w-[200px] truncate">{result.opportunityA?.title}</th>
                  <th className="px-4 py-4 text-center text-sm font-bold max-w-[200px] truncate">{result.opportunityB?.title}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <SectionRow label="Business Value" />
                <tr><td className="px-4 py-3 text-muted-foreground text-xs">Revenue Impact (AI)</td><CompareCell a={getAj("businessContext","arrImpact")} b={getBj("businessContext","arrImpact")} /></tr>
                <tr><td className="px-4 py-3 text-muted-foreground text-xs">Customer Count</td><CompareCell a={getAj("businessContext","customerCount")} b={getBj("businessContext","customerCount")} /></tr>
                <tr><td className="px-4 py-3 text-muted-foreground text-xs">Customer Reach (1-10)</td><CompareCell a={getAj("businessContext","customerReach")} b={getBj("businessContext","customerReach")} /></tr>
                <tr><td className="px-4 py-3 text-muted-foreground text-xs">Retention Impact (1-10)</td><CompareCell a={getAj("businessContext","retentionImpact")} b={getBj("businessContext","retentionImpact")} /></tr>
                <tr><td className="px-4 py-3 text-muted-foreground text-xs">Strategic Importance (1-10)</td><CompareCell a={getAj("businessContext","strategicAlignment")} b={getBj("businessContext","strategicAlignment")} /></tr>
                <tr><td className="px-4 py-3 text-muted-foreground text-xs">Revenue Opportunity</td><CompareCell a={getAj("businessContext","revenueOpportunity")} b={getBj("businessContext","revenueOpportunity")} /></tr>

                <SectionRow label="Prioritization Frameworks" />
                <tr><td className="px-4 py-3 text-muted-foreground text-xs">RICE Score</td><CompareCell a={getA("riceScore")?.toFixed?.(1)} b={getB("riceScore")?.toFixed?.(1)} /></tr>
                <tr><td className="px-4 py-3 text-muted-foreground text-xs">ICE Score</td><CompareCell a={getA("iceScore")?.toFixed?.(0)} b={getB("iceScore")?.toFixed?.(0)} /></tr>
                <tr><td className="px-4 py-3 text-muted-foreground text-xs">Weighted Score</td><CompareCell a={getA("weightedScore")?.toFixed?.(1)} b={getB("weightedScore")?.toFixed?.(1)} /></tr>
                <tr><td className="px-4 py-3 text-muted-foreground text-xs">Opportunity Score</td><CompareCell a={getA("opportunityScore")?.toFixed?.(1)} b={getB("opportunityScore")?.toFixed?.(1)} /></tr>
                <tr>
                  <td className="px-4 py-3 text-muted-foreground text-xs">MoSCoW</td>
                  <td className="px-4 py-3 text-center border-r">{getA("moscowCategory") ? <Badge variant="outline" className="text-xs">{MOSCOW_LABELS[getA("moscowCategory")] ?? getA("moscowCategory")}</Badge> : "—"}</td>
                  <td className="px-4 py-3 text-center">{getB("moscowCategory") ? <Badge variant="outline" className="text-xs">{MOSCOW_LABELS[getB("moscowCategory")] ?? getB("moscowCategory")}</Badge> : "—"}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-muted-foreground text-xs">Value vs Effort</td>
                  <td className="px-4 py-3 text-center border-r text-xs">{getA("vveQuadrant") ? QUADRANT_LABELS[getA("vveQuadrant")] : "—"}</td>
                  <td className="px-4 py-3 text-center text-xs">{getB("vveQuadrant") ? QUADRANT_LABELS[getB("vveQuadrant")] : "—"}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-muted-foreground text-xs">Kano Category</td>
                  <td className="px-4 py-3 text-center border-r text-xs capitalize">{getA("kanoCategory") ?? "—"}</td>
                  <td className="px-4 py-3 text-center text-xs capitalize">{getB("kanoCategory") ?? "—"}</td>
                </tr>

                <SectionRow label="Engineering Effort" />
                <tr><td className="px-4 py-3 text-muted-foreground text-xs">Frontend (SP)</td><CompareCell a={getAj("engineeringData","frontend")} b={getBj("engineeringData","frontend")} /></tr>
                <tr><td className="px-4 py-3 text-muted-foreground text-xs">Backend (SP)</td><CompareCell a={getAj("engineeringData","backend")} b={getBj("engineeringData","backend")} /></tr>
                <tr><td className="px-4 py-3 text-muted-foreground text-xs">Database (SP)</td><CompareCell a={getAj("engineeringData","database")} b={getBj("engineeringData","database")} /></tr>
                <tr><td className="px-4 py-3 text-muted-foreground text-xs">QA (SP)</td><CompareCell a={getAj("engineeringData","qa")} b={getBj("engineeringData","qa")} /></tr>
                <tr><td className="px-4 py-3 text-muted-foreground text-xs">Total Story Points</td><CompareCell a={getAj("engineeringData","totalStoryPoints")} b={getBj("engineeringData","totalStoryPoints")} /></tr>
                <tr><td className="px-4 py-3 text-muted-foreground text-xs">Sprint Count</td><CompareCell a={getAj("engineeringData","sprintCount")} b={getBj("engineeringData","sprintCount")} /></tr>
                <tr>
                  <td className="px-4 py-3 text-muted-foreground text-xs">Complexity</td>
                  <td className="px-4 py-3 text-center border-r text-xs">{getAj("engineeringData","complexity") ?? "—"}</td>
                  <td className="px-4 py-3 text-center text-xs">{getBj("engineeringData","complexity") ?? "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* AI Insight */}
      {result?.aiInsight && (
        <Card className="bg-ai/5 border-ai/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="size-5 text-ai" /> AI Comparison Insight
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-semibold text-ai mb-1">Winner: {result.aiInsight.winner}</p>
              <p className="text-muted-foreground">{result.aiInsight.reason}</p>
            </div>
            {result.aiInsight.risks?.length > 0 && (
              <div>
                <p className="font-medium mb-1">Risks</p>
                <ul className="space-y-1">
                  {result.aiInsight.risks.map((r: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-muted-foreground text-xs"><span className="mt-1 size-1.5 rounded-full bg-destructive/70 shrink-0" />{r}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.aiInsight.tradeoffs?.length > 0 && (
              <div>
                <p className="font-medium mb-1">Trade-offs</p>
                <ul className="space-y-1">
                  {result.aiInsight.tradeoffs.map((t: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-muted-foreground text-xs"><span className="mt-1 size-1.5 rounded-full bg-amber-500/70 shrink-0" />{t}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.aiInsight.recommendation && (
              <div className="pt-2 border-t">
                <p className="font-medium mb-1">Final Recommendation</p>
                <p className="text-muted-foreground">{result.aiInsight.recommendation}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
