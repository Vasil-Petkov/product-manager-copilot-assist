import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  Lightbulb,
  Loader2,
  Sparkles,
  Target,
  XCircle,
} from "lucide-react";
import {
  getListValidationExperimentsQueryKey,
  useAnalyzeValidationExperimentResult,
  useListValidationExperiments,
  useUpdateValidationExperiment,
  type ValidationExperiment,
  type ValidationResultAnalysis,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpTooltip } from "@/components/help-tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const OUTCOMES = [
  { value: "validated", label: "Validated", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20", icon: CheckCircle2 },
  { value: "invalidated", label: "Invalidated", className: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  { value: "inconclusive", label: "Inconclusive", className: "bg-amber-500/10 text-amber-700 border-amber-500/20", icon: AlertCircle },
  { value: "new_insight", label: "New Insight", className: "bg-blue-500/10 text-blue-700 border-blue-500/20", icon: Lightbulb },
] as const;

const PM_DECISIONS = [
  { value: "proceed", label: "Proceed" },
  { value: "iterate", label: "Iterate" },
  { value: "collect_more_evidence", label: "Collect more evidence" },
  { value: "stop", label: "Stop" },
] as const;

type Outcome = (typeof OUTCOMES)[number]["value"];
type PmDecision = (typeof PM_DECISIONS)[number]["value"];

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) {
    return <Badge variant="outline" className="font-normal text-muted-foreground">No outcome yet</Badge>;
  }
  const match = OUTCOMES.find((item) => item.value === outcome);
  if (!match) return null;
  const Icon = match.icon;
  return (
    <Badge variant="outline" className={`gap-1 font-medium ${match.className}`}>
      <Icon className="size-3" />
      {match.label}
    </Badge>
  );
}

function ResultStatus({ experiment }: { experiment: ValidationExperiment }) {
  if (experiment.actualResult) return <span className="text-xs text-muted-foreground">Result entered {format(new Date(experiment.resultEnteredAt ?? experiment.updatedAt), "MMM d, yyyy")}</span>;
  return <span className="text-xs text-muted-foreground">No result entered yet</span>;
}

function ResultsList({
  experiments,
  selectedId,
  onSelect,
}: {
  experiments: ValidationExperiment[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="space-y-2">
      {experiments.map((experiment) => {
        const selected = experiment.id === selectedId;
        return (
          <button
            type="button"
            key={experiment.id}
            onClick={() => onSelect(experiment.id)}
            className={`w-full rounded-lg border p-4 text-left transition-colors ${
              selected ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/40 hover:bg-muted/40"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold leading-tight line-clamp-1">{experiment.name}</p>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                  {experiment.hypothesis.productIdea.title}
                </p>
              </div>
              <OutcomeBadge outcome={experiment.outcome} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{experiment.method.name}</span>
              <ResultStatus experiment={experiment} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ResultDetail({ experiment }: { experiment: ValidationExperiment }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [actualResult, setActualResult] = useState(experiment.actualResult ?? "");
  const [outcome, setOutcome] = useState<Outcome | "none">(experiment.outcome as Outcome ?? "none");
  const [pmDecision, setPmDecision] = useState<PmDecision | "none">(experiment.pmDecision as PmDecision ?? "none");
  const [pmNotes, setPmNotes] = useState(experiment.pmNotes ?? "");
  const [analysis, setAnalysis] = useState<ValidationResultAnalysis | null>(null);

  useEffect(() => {
    setActualResult(experiment.actualResult ?? "");
    setOutcome((experiment.outcome as Outcome) ?? "none");
    setPmDecision((experiment.pmDecision as PmDecision) ?? "none");
    setPmNotes(experiment.pmNotes ?? "");
    setAnalysis(null);
  }, [experiment.id, experiment.actualResult, experiment.outcome, experiment.pmDecision, experiment.pmNotes]);

  const updateMutation = useUpdateValidationExperiment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListValidationExperimentsQueryKey() });
        toast({ title: "Validation result saved" });
      },
      onError: () => toast({ title: "Could not save the result", variant: "destructive" }),
    },
  });
  const analysisMutation = useAnalyzeValidationExperimentResult({
    mutation: {
      onSuccess: (data) => setAnalysis(data),
      onError: () => toast({
        title: "AI analysis is unavailable",
        description: "Your entered result has not been changed.",
        variant: "destructive",
      }),
    },
  });

  const saveResult = () => {
    updateMutation.mutate({
      id: experiment.id,
      data: {
        actualResult: actualResult.trim() || null,
        outcome: outcome === "none" ? null : outcome,
        pmDecision: pmDecision === "none" ? null : pmDecision,
        pmNotes: pmNotes.trim() || null,
      },
    });
  };

  const isDirty = actualResult !== (experiment.actualResult ?? "")
    || outcome !== ((experiment.outcome as Outcome) ?? "none")
    || pmDecision !== ((experiment.pmDecision as PmDecision) ?? "none")
    || pmNotes !== (experiment.pmNotes ?? "");

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product Idea</p>
              <CardTitle className="mt-1 text-xl">{experiment.hypothesis.productIdea.title}</CardTitle>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-sm text-muted-foreground">{experiment.name} · {experiment.method.name}</p>
                <Badge variant="outline" className="capitalize">{experiment.status}</Badge>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <OutcomeBadge outcome={experiment.outcome} />
              <Button asChild variant="outline" size="sm">
                <Link href={`/validation/experiments/${experiment.id}`}>Manage experiment</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Original hypothesis</p>
            <p className="mt-2 text-sm leading-relaxed">{experiment.hypothesis.statement}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Success criteria</p>
            <p className="mt-2 text-sm leading-relaxed">
              {experiment.successMeasures || experiment.hypothesis.successCriteria || "No success criteria entered yet."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Compare criteria with actual results</CardTitle>
          <p className="text-sm text-muted-foreground">
            Record what happened in your own words, then set the final outcome and PM decision.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-dashed p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Success criteria</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                {experiment.successMeasures || experiment.hypothesis.successCriteria || "No success criteria entered yet."}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actual result</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                {experiment.actualResult || "No result entered yet"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`actual-result-${experiment.id}`}>Enter or update actual result</label>
            <Textarea
              id={`actual-result-${experiment.id}`}
              value={actualResult}
              onChange={(event) => setActualResult(event.target.value)}
              className="min-h-[130px] resize-y"
              placeholder="Summarize the observed result, metrics, and evidence from this experiment."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Outcome</label>
              <Select value={outcome} onValueChange={(value) => setOutcome(value as Outcome | "none")}>
                <SelectTrigger><SelectValue placeholder="Set outcome" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No outcome yet</SelectItem>
                  {OUTCOMES.map((item) => <SelectItem value={item.value} key={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">PM decision</label>
              <Select value={pmDecision} onValueChange={(value) => setPmDecision(value as PmDecision | "none")}>
                <SelectTrigger><SelectValue placeholder="Set a PM decision" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No decision yet</SelectItem>
                  {PM_DECISIONS.map((item) => <SelectItem value={item.value} key={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">This remains separate from the AI recommendation.</p>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`pm-notes-${experiment.id}`}>PM notes</label>
            <Textarea
              id={`pm-notes-${experiment.id}`}
              value={pmNotes}
              onChange={(event) => setPmNotes(event.target.value)}
              className="min-h-[90px] resize-y"
              placeholder="Capture why you made this decision, caveats, or follow-up work."
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <span className="text-xs text-muted-foreground">
              {experiment.resultEnteredAt ? `Result last entered ${format(new Date(experiment.resultEnteredAt), "PPp")}` : "No result entered yet"}
            </span>
            <Button onClick={saveResult} disabled={!isDirty || updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save result
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="size-5 text-primary" /> Analyze with AI</CardTitle>
          <p className="text-sm text-muted-foreground">
            Optional and grounded only in the success criteria and actual result entered above. It does not change your outcome or PM decision.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            onClick={() => analysisMutation.mutate({ id: experiment.id })}
            disabled={!actualResult.trim() || analysisMutation.isPending}
          >
            {analysisMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
            Analyze entered result
          </Button>
          {!actualResult.trim() && <p className="text-xs text-muted-foreground">Enter an actual result to enable grounded analysis.</p>}
          {analysis && (
            <div className="space-y-3 rounded-lg border bg-background p-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI assessment</p>
                <p className="mt-1 leading-relaxed">{analysis.assessment}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><p className="text-xs font-semibold text-muted-foreground">Criteria referenced</p><p className="mt-1">{analysis.successCriteriaQuote || "No criteria were entered."}</p></div>
                <div><p className="text-xs font-semibold text-muted-foreground">Result referenced</p><p className="mt-1">{analysis.actualResultQuote}</p></div>
              </div>
              <div><p className="text-xs font-semibold text-muted-foreground">AI recommendation</p><p className="mt-1 capitalize">{analysis.recommendation.replaceAll("_", " ")}</p></div>
              {analysis.caveat && <p className="border-l-2 border-amber-400 pl-3 text-muted-foreground">{analysis.caveat}</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ValidationResults() {
  const { data: experiments, isLoading, isError, refetch } = useListValidationExperiments({ includeArchived: false });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selected = useMemo(
    () => experiments?.find((experiment) => experiment.id === selectedId) ?? experiments?.[0] ?? null,
    [experiments, selectedId],
  );

  const resultCount = experiments?.filter((experiment) => Boolean(experiment.actualResult)).length ?? 0;
  const validatedCount = experiments?.filter((experiment) => experiment.outcome === "validated").length ?? 0;

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto w-full space-y-6 animate-in fade-in">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="size-8 text-primary" />
          Validation Results
          <HelpTooltip
            purpose="Compare the evidence you entered with success criteria, record the outcome, and preserve the PM decision separately from AI advice."
            bullets={["Review all experiment evidence in one place", "Record one of four outcome types", "Keep final PM decisions and notes under your control", "Use AI only to analyze the data you entered"]}
          />
        </h1>
        <p className="text-muted-foreground max-w-2xl">Turn experiment evidence into a clear validation outcome while keeping your criteria, decision, and notes together.</p>
      </header>

      {isLoading ? (
        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <Skeleton className="h-[580px]" /><Skeleton className="h-[580px]" />
        </div>
      ) : isError ? (
        <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center"><AlertCircle className="size-10 text-muted-foreground" /><p className="font-medium">Unable to load validation results</p><Button variant="outline" onClick={() => refetch()}>Retry</Button></CardContent></Card>
      ) : !experiments?.length ? (
        <Card className="border-dashed"><CardContent className="flex flex-col items-center gap-4 p-12 text-center"><FlaskConical className="size-10 text-primary/60" /><div><p className="font-semibold">No experiments to review yet</p><p className="mt-1 text-sm text-muted-foreground">Choose a validation method and design an experiment before recording results.</p></div><Button asChild><Link href="/validation/methods"><Target className="mr-2 size-4" />Browse validation methods</Link></Button></CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Experiments</p><p className="mt-1 text-2xl font-bold">{experiments.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Results entered</p><p className="mt-1 text-2xl font-bold">{resultCount}</p></CardContent></Card>
            <Card className="col-span-2 md:col-span-1"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Validated</p><p className="mt-1 text-2xl font-bold">{validatedCount}</p></CardContent></Card>
          </div>
          <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
            <Card className="h-fit">
              <CardHeader className="pb-3"><CardTitle className="text-lg">Experiments</CardTitle><p className="text-sm text-muted-foreground">Select an experiment to enter or review its result.</p></CardHeader>
              <CardContent><ResultsList experiments={experiments} selectedId={selected?.id ?? null} onSelect={setSelectedId} /></CardContent>
            </Card>
            {selected && <ResultDetail key={selected.id} experiment={selected} />}
          </div>
        </>
      )}
    </div>
  );
}