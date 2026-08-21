import { useState } from "react";
import { useListPrioritization } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Framework = "rice" | "ice" | "weighted" | "moscow" | "vve" | "kano" | "opportunity";

const FRAMEWORKS: { id: Framework; label: string }[] = [
  { id: "rice", label: "RICE" },
  { id: "ice", label: "ICE" },
  { id: "weighted", label: "Weighted Score" },
  { id: "moscow", label: "MoSCoW" },
  { id: "vve", label: "Value vs Effort" },
  { id: "kano", label: "Kano Model" },
  { id: "opportunity", label: "Opportunity Score" },
];

const DESCRIPTIONS: Record<Framework, string> = {
  rice: "RICE = (Reach × Impact × Confidence%) / Effort (Story Points). Higher is better.",
  ice: "ICE = Impact (1–10) × Confidence (1–10) × Ease (1–10). Higher is better.",
  weighted: "Weighted Score combines customer value, revenue, strategic alignment, complexity, competitive advantage, and risk.",
  moscow: "MoSCoW classifies each idea as Must Have, Should Have, Could Have, or Won't Have.",
  vve: "Value vs Effort groups ideas into Quick Wins, Strategic, Fill-ins, and Avoid.",
  kano: "Kano classifies ideas as Basic, Performance, Excitement, Indifferent, or Reverse.",
  opportunity: "Opportunity Score measures underserved demand from importance and satisfaction.",
};

const MOSCOW_LABELS: Record<string, string> = {
  must_have: "Must Have",
  should_have: "Should Have",
  could_have: "Could Have",
  wont_have: "Won't Have",
};

const QUADRANT_LABELS: Record<string, string> = {
  high_value_low_effort: "Quick Win",
  high_value_high_effort: "Strategic",
  low_value_low_effort: "Fill-in",
  low_value_high_effort: "Avoid",
};

function Score({ value, digits = 1 }: { value: number | null | undefined; digits?: number }) {
  return <span className="font-bold text-primary font-mono">{value == null ? "—" : Number(value).toFixed(digits)}</span>;
}

export default function ResultsTab() {
  const [framework, setFramework] = useState<Framework>("rice");
  const { data: items, isLoading } = useListPrioritization({});
  const analyzed = items?.filter((item) => item.analyzed) ?? [];

  return (
    <div className="space-y-4">
      <Tabs value={framework} onValueChange={(value) => setFramework(value as Framework)}>
        <TabsList className="bg-muted p-1 flex-wrap h-auto gap-1">
          {FRAMEWORKS.map((item) => (
            <TabsTrigger key={item.id} value={item.id} className="data-[state=active]:bg-card text-xs px-3">
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <strong>{FRAMEWORKS.find((item) => item.id === framework)?.label}</strong> — {DESCRIPTIONS[framework]}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b">
              <tr>
                <th className="px-6 py-4 text-center">#</th>
                <th className="px-6 py-4">Product Idea</th>
                {framework === "rice" && <><th className="px-6 py-4 text-center">Reach</th><th className="px-6 py-4 text-center">Impact</th><th className="px-6 py-4 text-center">Confidence</th><th className="px-6 py-4 text-center">Effort</th><th className="px-6 py-4 text-center">RICE Score</th></>}
                {framework === "ice" && <><th className="px-6 py-4 text-center">Impact</th><th className="px-6 py-4 text-center">Confidence</th><th className="px-6 py-4 text-center">Ease</th><th className="px-6 py-4 text-center">ICE Score</th></>}
                {framework === "weighted" && <><th className="px-6 py-4 text-center">Customer Value</th><th className="px-6 py-4 text-center">Revenue</th><th className="px-6 py-4 text-center">Strategic</th><th className="px-6 py-4 text-center">Complexity</th><th className="px-6 py-4 text-center">Score</th></>}
                {framework === "moscow" && <th className="px-6 py-4">Classification</th>}
                {framework === "vve" && <><th className="px-6 py-4 text-center">Business Value</th><th className="px-6 py-4 text-center">Engineering Effort</th><th className="px-6 py-4">Quadrant</th></>}
                {framework === "kano" && <th className="px-6 py-4">Category</th>}
                {framework === "opportunity" && <><th className="px-6 py-4 text-center">Importance</th><th className="px-6 py-4 text-center">Satisfaction</th><th className="px-6 py-4 text-center">Opportunity Score</th></>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? Array.from({ length: 5 }).map((_, index) => (
                <tr key={index}><td colSpan={8} className="px-6 py-4"><Skeleton className="h-4 w-full" /></td></tr>
              )) : !analyzed.length ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">No analyzed ideas yet. Analyze a Product Idea to view its framework results.</td></tr>
              ) : analyzed.map((item, index) => {
                const entry = item as any;
                const rice = entry.riceData ?? entry.riceScore;
                const ice = entry.iceScore;
                const weighted = entry.weightedData;
                const vve = entry.vveData;
                const opportunity = entry.opportunityData;
                return (
                  <tr key={item.opportunity.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 text-center"><div className="size-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground mx-auto">{index + 1}</div></td>
                    <td className="px-6 py-4 font-medium">{item.opportunity.title}</td>
                    {framework === "rice" && <><td className="px-6 py-4 text-center">{rice?.reach ?? "—"}</td><td className="px-6 py-4 text-center">{rice?.impactLabel ?? rice?.impact ?? "—"}</td><td className="px-6 py-4 text-center">{rice?.confidence == null ? "—" : `${rice.confidence}%`}</td><td className="px-6 py-4 text-center">{rice?.effortPoints ?? rice?.effort ?? "—"}</td><td className="px-6 py-4 text-center"><Score value={rice?.score} /></td></>}
                    {framework === "ice" && <><td className="px-6 py-4 text-center">{ice?.impact ?? "—"}</td><td className="px-6 py-4 text-center">{ice?.confidence ?? "—"}</td><td className="px-6 py-4 text-center">{ice?.ease ?? "—"}</td><td className="px-6 py-4 text-center"><Score value={ice?.score} digits={0} /></td></>}
                    {framework === "weighted" && <><td className="px-6 py-4 text-center">{weighted?.customerValue ?? "—"}</td><td className="px-6 py-4 text-center">{weighted?.revenueImpact ?? "—"}</td><td className="px-6 py-4 text-center">{weighted?.strategicAlignment ?? "—"}</td><td className="px-6 py-4 text-center">{weighted?.technicalComplexity ?? "—"}</td><td className="px-6 py-4 text-center"><Score value={item.weightedScore} /></td></>}
                    {framework === "moscow" && <td className="px-6 py-4">{item.moscowCategory ? <Badge variant="outline">{MOSCOW_LABELS[item.moscowCategory] ?? item.moscowCategory}</Badge> : "—"}</td>}
                    {framework === "vve" && <><td className="px-6 py-4 text-center">{vve?.businessValue ?? "—"}</td><td className="px-6 py-4 text-center">{vve?.engineeringEffort ?? "—"}</td><td className="px-6 py-4">{item.vveQuadrant ? <Badge variant="outline">{QUADRANT_LABELS[item.vveQuadrant] ?? item.vveQuadrant}</Badge> : "—"}</td></>}
                    {framework === "kano" && <td className="px-6 py-4">{item.kanoCategory ? <Badge variant="outline" className="capitalize">{item.kanoCategory}</Badge> : "—"}</td>}
                    {framework === "opportunity" && <><td className="px-6 py-4 text-center">{opportunity?.importance ?? "—"}</td><td className="px-6 py-4 text-center">{opportunity?.satisfaction ?? "—"}</td><td className="px-6 py-4 text-center"><Score value={item.opportunityScore} /></td></>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}