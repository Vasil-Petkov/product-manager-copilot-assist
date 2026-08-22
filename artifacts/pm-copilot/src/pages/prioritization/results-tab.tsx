import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListPrioritizationQueryKey,
  useListPrioritization,
  useScoreOpportunity,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Framework display config ────────────────────────────────────────────────

const MOSCOW_COLORS: Record<string, string> = {
  must_have:   "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  should_have: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  could_have:  "bg-amber-500/10 text-amber-700 border-amber-500/20",
  wont_have:   "bg-slate-500/10 text-slate-600 border-slate-500/20",
};
const MOSCOW_LABELS: Record<string, string> = {
  must_have: "Must Have", should_have: "Should Have",
  could_have: "Could Have", wont_have: "Won't Have",
};
const KANO_COLORS: Record<string, string> = {
  basic:       "bg-slate-500/10 text-slate-600 border-slate-500/20",
  performance: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  excitement:  "bg-purple-500/10 text-purple-700 border-purple-500/20",
  indifferent: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  reverse:     "bg-red-500/10 text-red-700 border-red-500/20",
};
const QUADRANT_META: Record<string, { label: string; color: string }> = {
  high_value_low_effort:  { label: "Quick Win 🚀",  color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  high_value_high_effort: { label: "Strategic 🎯",  color: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
  low_value_low_effort:   { label: "Fill-in 📦",    color: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  low_value_high_effort:  { label: "Avoid ❌",       color: "bg-red-500/10 text-red-700 border-red-500/20" },
};

type Framework = "rice" | "ice" | "weighted" | "moscow" | "vve" | "kano" | "opportunity";
const FRAMEWORKS: { id: Framework; label: string }[] = [
  { id: "rice",        label: "RICE" },
  { id: "ice",         label: "ICE" },
  { id: "weighted",    label: "Weighted Score" },
  { id: "moscow",      label: "MoSCoW" },
  { id: "vve",         label: "Value vs Effort" },
  { id: "kano",        label: "Kano Model" },
  { id: "opportunity", label: "Opportunity Score" },
];

const RICE_IMPACT_OPTIONS = [
  { label: "Massive", value: 3 },
  { label: "High", value: 2 },
  { label: "Medium", value: 1 },
  { label: "Low", value: 0.5 },
  { label: "Minimal", value: 0.25 },
] as const;

type RiceDetails = {
  reach?: number | null;
  impact?: number | null;
  impactValue?: number | null;
  impactLabel?: string | null;
  confidence?: number | null;
  effort?: number | null;
  effortPoints?: number | null;
  score?: number | null;
  explanation?: string | null;
};

function MissingData() {
  return <span className="text-muted-foreground">Not available</span>;
}

function formatRiceImpact(impact?: number | null, label?: string | null) {
  const option = RICE_IMPACT_OPTIONS.find((item) => item.value === impact)
    ?? RICE_IMPACT_OPTIONS.find((item) => item.label === label);
  return option ? `${option.label} (${option.value})` : null;
}

function ScoreBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(Math.max((value / max) * 100, 2), 100);
  return (
    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}

function ExplanationRow({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="px-6 pb-3 flex items-start gap-2 text-xs text-muted-foreground">
      <Info className="size-3 mt-0.5 shrink-0 text-ai" />
      <span>{text}</span>
    </div>
  );
}

export default function ResultsTab() {
  const [fw, setFw] = useState<Framework>("rice");
  const { data: items, isLoading } = useListPrioritization({});
  const scoreOpportunity = useScoreOpportunity();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingItem, setEditingItem] = useState<NonNullable<typeof items>[number] | null>(null);
  const [riceForm, setRiceForm] = useState<RiceFormValues>(EMPTY_RICE_FORM);
  const [riceError, setRiceError] = useState("");

  const opportunities = items ?? [];

  const openRiceEditor = (item: (typeof opportunities)[number]) => {
    const rice = item.riceScore as RiceDetails | null;
    setEditingItem(item);
    setRiceForm({
      reach: rice?.reach != null ? String(rice.reach) : "",
      impact: rice?.impactValue != null
        ? String(rice.impactValue)
        : rice?.impact != null
          ? String(rice.impact)
          : "",
      confidence: rice?.confidence != null ? String(rice.confidence) : "",
      effort: rice?.effortPoints != null
        ? String(rice.effortPoints)
        : rice?.effort != null
          ? String(rice.effort)
          : "",
    });
    setRiceError("");
  };

  const closeRiceEditor = () => {
    if (!scoreOpportunity.isPending) {
      setEditingItem(null);
      setRiceError("");
    }
  };

  const saveRice = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reach = Number(riceForm.reach);
    const impact = Number(riceForm.impact);
    const confidence = Number(riceForm.confidence);
    const effort = Number(riceForm.effort);

    if (
      !riceForm.reach.trim() ||
      !riceForm.impact.trim() ||
      !riceForm.confidence.trim() ||
      !riceForm.effort.trim() ||
      ![reach, impact, confidence, effort].every(Number.isFinite)
    ) {
      setRiceError("Enter a number for every RICE input.");
      return;
    }
    if (reach <= 0 || impact <= 0 || confidence <= 0 || confidence > 100 || effort <= 0) {
      setRiceError("Reach, Impact, Confidence, and Effort must be greater than zero. Confidence cannot exceed 100%.");
      return;
    }
    if (!editingItem) return;

    scoreOpportunity.mutate(
      {
        data: {
          opportunityId: editingItem.opportunity.id,
          framework: "rice",
          riceReach: reach,
          riceImpact: impact,
          riceConfidence: confidence,
          riceEffort: effort,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPrioritizationQueryKey({}) });
          setEditingItem(null);
          setRiceError("");
          toast({ title: "RICE score saved", description: "The updated inputs and score are now available in Results." });
        },
        onError: () => setRiceError("Unable to save the RICE inputs. Please try again."),
      },
    );
  };

  return (
    <div className="space-y-4">
      <Tabs value={fw} onValueChange={(v) => setFw(v as Framework)}>
        <TabsList className="bg-muted p-1 flex-wrap h-auto gap-1">
          {FRAMEWORKS.map(f => (
            <TabsTrigger key={f.id} value={f.id} className="data-[state=active]:bg-card text-xs px-3">
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Framework info card */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          {fw === "rice"        && <><strong>RICE</strong> = (Reach × Impact × Confidence%) / Effort (Story Points). Higher is better.</>}
          {fw === "ice"         && <><strong>ICE</strong> = Impact (1–10) × Confidence (1–10) × Ease (1–10). Higher is better.</>}
          {fw === "weighted"    && <><strong>Weighted Score</strong> = CustomerValue×25% + RevenueImpact×20% + StrategicAlignment×20% + TechnicalComplexity×15% + CompetitiveAdvantage×10% + Risk×10%. Each criterion 1–10.</>}
          {fw === "moscow"      && <><strong>MoSCoW</strong> — AI classifies each idea as Must Have, Should Have, Could Have, or Won't Have.</>}
          {fw === "vve"         && <><strong>Value vs Effort</strong> — 2×2 matrix: Business Value (1–10) vs Engineering Effort (1–10). Quick wins are high value, low effort.</>}
          {fw === "kano"        && <><strong>Kano Model</strong> — AI classifies ideas as Basic, Performance, Excitement, Indifferent, or Reverse.</>}
          {fw === "opportunity" && <><strong>Opportunity Score</strong> = Importance + (Importance − Satisfaction). Captures underserved demand.</>}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b">
              <tr>
                <th className="px-6 py-4 w-10 text-center">#</th>
                <th className="px-6 py-4">Product Idea</th>
                {fw === "rice"        && <><th className="px-6 py-4 text-center">Reach</th><th className="px-6 py-4 text-center">Impact</th><th className="px-6 py-4 text-center">Confidence</th><th className="px-6 py-4 text-center">Effort SP</th><th className="px-6 py-4 text-center text-primary">RICE Score</th><th className="px-6 py-4 text-center">Actions</th></>}
                {fw === "ice"         && <><th className="px-6 py-4 text-center">Impact</th><th className="px-6 py-4 text-center">Confidence</th><th className="px-6 py-4 text-center">Ease</th><th className="px-6 py-4 text-center text-primary">ICE Score</th></>}
                {fw === "weighted"    && <><th className="px-6 py-4 text-center">Cust. Value</th><th className="px-6 py-4 text-center">Revenue</th><th className="px-6 py-4 text-center">Strategic</th><th className="px-6 py-4 text-center">Complexity</th><th className="px-6 py-4 text-center text-primary">Score</th></>}
                {fw === "moscow"      && <th className="px-6 py-4">Classification</th>}
                {fw === "vve"         && <><th className="px-6 py-4 text-center">Business Value</th><th className="px-6 py-4 text-center">Eng. Effort</th><th className="px-6 py-4">Quadrant</th></>}
                {fw === "kano"        && <th className="px-6 py-4">Category</th>}
                {fw === "opportunity" && <><th className="px-6 py-4 text-center">Importance</th><th className="px-6 py-4 text-center">Satisfaction</th><th className="px-6 py-4 text-center text-primary">Opp. Score</th></>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={8} className="px-6 py-4"><Skeleton className="h-4 w-full" /></td></tr>
              )) : !opportunities.length ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground text-sm">
                  No Product Ideas yet.
                </td></tr>
              ) : opportunities.map((item, idx) => {
                const rice = item.riceScore as RiceDetails | null;
                const ice  = item.iceScore as Record<string, any> | null;
                const wd   = (item as any).weightedData as Record<string, any> | null;
                const vve  = (item as any).vveData as Record<string, any> | null;
                const opp  = (item as any).opportunityData as Record<string, any> | null;
                const riceData = rice;
                const vveQ = item.vveQuadrant as string | null;
                const quadrant = vveQ ? QUADRANT_META[vveQ] : null;

                return [
                  <tr key={`row-${item.opportunity.id}`} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 text-center">
                      <div className="size-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground mx-auto">{idx + 1}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium">{item.opportunity.title}</span>
                    </td>

                    {fw === "rice" && (<>
                       <td className="px-6 py-4 text-center font-mono text-sm">{riceData?.reach ?? <MissingData />}</td>
                       <td className="px-6 py-4 text-center text-sm">{formatRiceImpact(riceData?.impactValue ?? riceData?.impact, riceData?.impactLabel) ?? <MissingData />}</td>
                       <td className="px-6 py-4 text-center font-mono text-sm">{riceData?.confidence != null ? `${riceData.confidence}%` : <MissingData />}</td>
                       <td className="px-6 py-4 text-center font-mono text-sm">{riceData?.effortPoints ?? riceData?.effort ?? <MissingData />}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <ScoreBar value={riceData?.score ?? 0} max={500} />
                           <span className="font-bold text-primary font-mono">{riceData?.score?.toFixed(1) ?? <MissingData />}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => openRiceEditor(item)}
                        >
                          <Pencil className="size-3.5" />
                          {riceData ? "Edit RICE" : "Add RICE"}
                        </Button>
                      </td>
                    </>)}

                    {fw === "ice" && (<>
                       <td className="px-6 py-4 text-center font-mono">{(ice as any)?.impact ?? <MissingData />}</td>
                       <td className="px-6 py-4 text-center font-mono">{(ice as any)?.confidence ?? <MissingData />}</td>
                       <td className="px-6 py-4 text-center font-mono">{(ice as any)?.ease ?? <MissingData />}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <ScoreBar value={(ice as any)?.score ?? 0} max={1000} />
                           <span className="font-bold text-primary font-mono">{(ice as any)?.score?.toFixed(0) ?? <MissingData />}</span>
                        </div>
                      </td>
                    </>)}

                    {fw === "weighted" && (<>
                       <td className="px-6 py-4 text-center font-mono">{wd?.customerValue ?? <MissingData />}</td>
                       <td className="px-6 py-4 text-center font-mono">{wd?.revenueImpact ?? <MissingData />}</td>
                       <td className="px-6 py-4 text-center font-mono">{wd?.strategicAlignment ?? <MissingData />}</td>
                       <td className="px-6 py-4 text-center font-mono">{wd?.technicalComplexity ?? <MissingData />}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <ScoreBar value={item.weightedScore ?? 0} max={10} />
                           <span className="font-bold text-primary font-mono">{item.weightedScore?.toFixed(1) ?? <MissingData />}</span>
                        </div>
                      </td>
                    </>)}

                    {fw === "moscow" && (
                      <td className="px-6 py-4">
                        {item.moscowCategory
                          ? <Badge variant="outline" className={MOSCOW_COLORS[item.moscowCategory] ?? ""}>{MOSCOW_LABELS[item.moscowCategory] ?? item.moscowCategory}</Badge>
                           : <MissingData />}
                      </td>
                    )}

                    {fw === "vve" && (<>
                       <td className="px-6 py-4 text-center font-mono">{vve?.businessValue != null ? `${vve.businessValue} / 10` : <MissingData />}</td>
                       <td className="px-6 py-4 text-center font-mono">{vve?.engineeringEffort != null ? `${vve.engineeringEffort} / 10` : <MissingData />}</td>
                      <td className="px-6 py-4">
                        {quadrant
                          ? <Badge variant="outline" className={quadrant.color}>{quadrant.label}</Badge>
                           : <MissingData />}
                      </td>
                    </>)}

                    {fw === "kano" && (
                      <td className="px-6 py-4">
                        {item.kanoCategory
                          ? <Badge variant="outline" className={KANO_COLORS[item.kanoCategory] ?? ""}>{item.kanoCategory.charAt(0).toUpperCase() + item.kanoCategory.slice(1)}</Badge>
                           : <MissingData />}
                      </td>
                    )}

                    {fw === "opportunity" && (<>
                       <td className="px-6 py-4 text-center font-mono">{opp?.importance ?? <MissingData />}</td>
                       <td className="px-6 py-4 text-center font-mono">{opp?.satisfaction ?? <MissingData />}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <ScoreBar value={item.opportunityScore ?? 0} max={20} />
                           <span className="font-bold text-primary font-mono">{item.opportunityScore?.toFixed(1) ?? <MissingData />}</span>
                        </div>
                      </td>
                    </>)}
                  </tr>,
                  // AI explanation row
                  fw === "rice"        && riceData?.explanation && <tr key={`exp-${item.opportunity.id}`} className="bg-ai/5"><td colSpan={9}><ExplanationRow text={riceData.explanation} /></td></tr>,
                  fw === "ice"         && (ice as any)?.explanation       && <tr key={`exp-${item.opportunity.id}`} className="bg-ai/5"><td colSpan={6}><ExplanationRow text={(ice as any).explanation} /></td></tr>,
                  fw === "weighted"    && wd?.explanation                  && <tr key={`exp-${item.opportunity.id}`} className="bg-ai/5"><td colSpan={7}><ExplanationRow text={wd.explanation} /></td></tr>,
                  fw === "moscow"      && (item as any).moscowData?.explanation && <tr key={`exp-${item.opportunity.id}`} className="bg-ai/5"><td colSpan={4}><ExplanationRow text={(item as any).moscowData.explanation} /></td></tr>,
                  fw === "vve"         && vve?.explanation                 && <tr key={`exp-${item.opportunity.id}`} className="bg-ai/5"><td colSpan={5}><ExplanationRow text={vve.explanation} /></td></tr>,
                  fw === "kano"        && (item as any).kanoData?.explanation && <tr key={`exp-${item.opportunity.id}`} className="bg-ai/5"><td colSpan={4}><ExplanationRow text={(item as any).kanoData.explanation} /></td></tr>,
                  fw === "opportunity" && opp?.explanation                 && <tr key={`exp-${item.opportunity.id}`} className="bg-ai/5"><td colSpan={6}><ExplanationRow text={opp.explanation} /></td></tr>,
                ].filter(Boolean);
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={editingItem !== null} onOpenChange={(open) => !open && closeRiceEditor()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>RICE score</DialogTitle>
            <DialogDescription>
              Enter the inputs for <strong>{editingItem?.opportunity.title}</strong>. Confidence is a percentage.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveRice} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rice-reach">Reach</Label>
                <Input
                  id="rice-reach"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="500"
                  value={riceForm.reach}
                  onChange={(event) => setRiceForm((current) => ({ ...current, reach: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rice-impact">Impact</Label>
                <Select
                  value={riceForm.impact}
                  onValueChange={(value) => setRiceForm((current) => ({ ...current, impact: value }))}
                >
                  <SelectTrigger id="rice-impact">
                    <SelectValue placeholder="Select impact" />
                  </SelectTrigger>
                  <SelectContent>
                    {RICE_IMPACT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>
                        {option.label} ({option.value})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rice-confidence">Confidence (%)</Label>
                <Input
                  id="rice-confidence"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="80"
                  value={riceForm.confidence}
                  onChange={(event) => setRiceForm((current) => ({ ...current, confidence: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rice-effort">Effort (story points)</Label>
                <Input
                  id="rice-effort"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="5"
                  value={riceForm.effort}
                  onChange={(event) => setRiceForm((current) => ({ ...current, effort: event.target.value }))}
                />
              </div>
            </div>
            {riceError && <p className="text-sm text-destructive">{riceError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeRiceEditor} disabled={scoreOpportunity.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={scoreOpportunity.isPending}>
                {scoreOpportunity.isPending ? "Saving…" : "Save RICE"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const EMPTY_RICE_FORM: RiceFormValues = {
  reach: "",
  impact: "",
  confidence: "",
  effort: "",
};

type RiceFormValues = {
  reach: string;
  impact: string;
  confidence: string;
  effort: string;
};
