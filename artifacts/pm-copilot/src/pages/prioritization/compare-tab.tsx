import { useState } from "react";
import { useCompareFeatures, useListPrioritization } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Brain, GitCompare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function Section({ title }: { title: string }) {
  return <tr className="bg-muted/50"><td colSpan={3} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</td></tr>;
}

function Row({ label, a, b }: { label: string; a: React.ReactNode; b: React.ReactNode }) {
  return <tr><td className="px-4 py-3 text-muted-foreground text-xs">{label}</td><td className="px-4 py-3 text-center border-r">{a ?? "—"}</td><td className="px-4 py-3 text-center">{b ?? "—"}</td></tr>;
}

export default function CompareTab() {
  const { data: items, isLoading } = useListPrioritization({});
  const compare = useCompareFeatures();
  const { toast } = useToast();
  const [idA, setIdA] = useState<number | null>(null);
  const [idB, setIdB] = useState<number | null>(null);
  const [result, setResult] = useState<any>(null);
  const options = items ?? [];
  const first = options.find((item) => item.opportunity.id === idA);
  const second = options.find((item) => item.opportunity.id === idB);

  const submit = () => {
    if (!idA || !idB || idA === idB) {
      toast({ title: "Select two different ideas to compare.", variant: "destructive" });
      return;
    }
    compare.mutate({ data: { idA, idB } }, {
      onSuccess: setResult,
      onError: () => toast({ title: "Comparison failed", description: "Please try again.", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>;

  const dataA = result?.analysisA;
  const dataB = result?.analysisB;
  const field = (data: any, key: string) => data?.[key];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {[{ label: "Feature A", value: idA, setValue: setIdA, other: idB }, { label: "Feature B", value: idB, setValue: setIdB, other: idA }].map(({ label, value, setValue, other }) => (
              <label key={label} className="block text-sm font-medium">
                {label}
                <select value={value ?? ""} onChange={(event) => setValue(Number(event.target.value) || null)} className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select a product idea…</option>
                  {options.map((item) => <option key={item.opportunity.id} value={item.opportunity.id} disabled={item.opportunity.id === other}>{item.opportunity.title}{!item.analyzed ? " (not analyzed)" : ""}</option>)}
                </select>
              </label>
            ))}
          </div>
          <Button onClick={submit} disabled={compare.isPending || !idA || !idB} className="gap-2"><GitCompare className="size-4" />{compare.isPending ? "Comparing…" : "Compare with AI"}</Button>
          {idA && idB && (!first?.analyzed || !second?.analyzed) && <p className="text-xs text-amber-600 mt-3 flex items-center gap-1"><AlertTriangle className="size-3" />One or both ideas have not been analyzed. Results may be limited.</p>}
        </CardContent>
      </Card>

      {result && <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary/50"><tr><th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Criterion</th><th className="px-4 py-4 text-center border-r">{result.opportunityA?.title}</th><th className="px-4 py-4 text-center">{result.opportunityB?.title}</th></tr></thead>
            <tbody className="divide-y divide-border">
              <Section title="Prioritization Frameworks" />
              <Row label="RICE Score" a={field(dataA, "riceScore")?.toFixed?.(1)} b={field(dataB, "riceScore")?.toFixed?.(1)} />
              <Row label="ICE Score" a={field(dataA, "iceScore")?.toFixed?.(0)} b={field(dataB, "iceScore")?.toFixed?.(0)} />
              <Row label="Weighted Score" a={field(dataA, "weightedScore")?.toFixed?.(1)} b={field(dataB, "weightedScore")?.toFixed?.(1)} />
              <Row label="Opportunity Score" a={field(dataA, "opportunityScore")?.toFixed?.(1)} b={field(dataB, "opportunityScore")?.toFixed?.(1)} />
              <Row label="MoSCoW" a={field(dataA, "moscowCategory")} b={field(dataB, "moscowCategory")} />
              <Row label="Kano Category" a={field(dataA, "kanoCategory")} b={field(dataB, "kanoCategory")} />
              <Section title="Business Value" />
              <Row label="Revenue Impact" a={dataA?.businessContext?.arrImpact} b={dataB?.businessContext?.arrImpact} />
              <Row label="Customer Reach" a={dataA?.businessContext?.customerReach} b={dataB?.businessContext?.customerReach} />
              <Row label="Strategic Alignment" a={dataA?.businessContext?.strategicAlignment} b={dataB?.businessContext?.strategicAlignment} />
              <Section title="Engineering Effort" />
              <Row label="Frontend (SP)" a={dataA?.engineeringData?.frontend} b={dataB?.engineeringData?.frontend} />
              <Row label="Backend (SP)" a={dataA?.engineeringData?.backend} b={dataB?.engineeringData?.backend} />
              <Row label="Total Story Points" a={dataA?.engineeringData?.totalStoryPoints} b={dataB?.engineeringData?.totalStoryPoints} />
            </tbody>
          </table>
        </div>
      </Card>}

      {result?.aiInsight && <Card className="bg-ai/5 border-ai/20">
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Brain className="size-5 text-ai" />AI Comparison Insight</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p><strong className="text-ai">Winner: {result.aiInsight.winner}</strong></p>
          <p className="text-muted-foreground">{result.aiInsight.reason}</p>
          {result.aiInsight.recommendation && <p className="border-t pt-3"><strong>Final Recommendation:</strong> {result.aiInsight.recommendation}</p>}
        </CardContent>
      </Card>}
    </div>
  );
}