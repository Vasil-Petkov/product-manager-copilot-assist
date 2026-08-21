import {
  useGetValidationHypothesis,
  useDuplicateValidationHypothesis,
  useArchiveValidationHypothesis,
  getGetValidationHypothesisQueryKey,
  getListValidationHypothesesQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, Copy, Archive, FileText, Target, Brain, ShieldAlert, Sparkles, MessageSquare, Signal, FlaskConical } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function HypothesisDetail({ hypothesisId, onEdit, onArchive, onDuplicate }: { hypothesisId: number, onEdit: () => void, onArchive: () => void, onDuplicate: (id: number) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: hypothesis, isLoading, isError, refetch } = useGetValidationHypothesis(hypothesisId, {
    query: {
      enabled: !!hypothesisId,
      queryKey: getGetValidationHypothesisQueryKey(hypothesisId)
    }
  });

  const duplicateMutation = useDuplicateValidationHypothesis({
    mutation: {
      onSuccess: (newHypothesis) => {
        toast({ title: "Hypothesis duplicated successfully." });
        queryClient.invalidateQueries({ queryKey: getListValidationHypothesesQueryKey() });
        onDuplicate(newHypothesis.id);
      },
      onError: () => {
        toast({ title: "Failed to duplicate", variant: "destructive" });
      }
    }
  });

  const archiveMutation = useArchiveValidationHypothesis({
    mutation: {
      onSuccess: () => {
        toast({ title: "Hypothesis archived." });
        queryClient.invalidateQueries({ queryKey: getListValidationHypothesesQueryKey() });
        onArchive();
      },
      onError: () => {
        toast({ title: "Failed to archive", variant: "destructive" });
      }
    }
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-4 w-1/4" />
        <div className="space-y-4 pt-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !hypothesis) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <ShieldAlert className="size-10 mb-4 opacity-50" />
        <p className="text-lg font-medium">Failed to load hypothesis</p>
        <p className="text-sm mb-4">The hypothesis might have been deleted or you don't have access.</p>
        <Button
          variant="outline"
          onClick={() => refetch()}
          data-testid="button-retry-hypothesis-detail"
        >
          Retry
        </Button>
      </div>
    );
  }

  const { productIdea, prioritization } = hypothesis;

  return (
    <div className="flex flex-col h-full animate-in fade-in max-w-4xl mx-auto">
      <div className="p-6 md:p-8 border-b bg-card sticky top-0 z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="uppercase tracking-wider text-[10px]">
              {hypothesis.hypothesisType}
            </Badge>
            <Badge variant={
              hypothesis.status === 'validated' ? 'secondary' :
              hypothesis.status === 'invalidated' ? 'destructive' :
              hypothesis.status === 'in_validation' ? 'default' :
              'outline'
            } className={`capitalize text-[10px] ${
              hypothesis.status === "validated"
                ? "bg-success/10 text-success hover:bg-success/10"
                : ""
            }`}>
              {hypothesis.status.replace(/_/g, ' ')}
            </Badge>
            {hypothesis.archivedAt && (
              <Badge variant="destructive" className="uppercase tracking-wider text-[10px]">Archived</Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold text-foreground leading-tight" data-testid="text-hypothesis-statement">
            {hypothesis.statement}
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 pt-2">
            <FileText className="size-4" />
            From Idea: <span className="font-medium text-foreground">{productIdea?.title || "Unknown Idea"}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {!hypothesis.archivedAt && (
            <Button asChild variant="default" size="sm" data-testid="button-design-experiment">
              <Link href={`/validation/experiments/new?hypothesisId=${hypothesisId}`}>
                <FlaskConical className="size-4 mr-2" />
                Design Experiment
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onEdit} disabled={!!hypothesis.archivedAt} data-testid="button-edit-hypothesis">
            <Edit className="size-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => duplicateMutation.mutate({ id: hypothesisId })} disabled={duplicateMutation.isPending} data-testid="button-duplicate-hypothesis">
            <Copy className="size-4 mr-2" />
            Duplicate
          </Button>
          {!hypothesis.archivedAt && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={archiveMutation.isPending} data-testid="button-archive-hypothesis">
                  <Archive className="size-4 mr-2" />
                  Archive
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive this hypothesis?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the hypothesis from active validation views while retaining
                    its record for history.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => archiveMutation.mutate({ id: hypothesisId })}
                    data-testid="button-confirm-archive"
                  >
                    Yes, archive
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="p-6 md:p-8 overflow-y-auto space-y-8">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
                <Brain className="size-4" /> Riskiest Assumption
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {hypothesis.assumption ? (
                <p className="leading-relaxed" data-testid="text-hypothesis-assumption">{hypothesis.assumption}</p>
              ) : (
                <p className="text-muted-foreground italic">No assumption documented.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-success">
                <Target className="size-4" /> Success Criteria
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {hypothesis.successCriteria ? (
                <p className="leading-relaxed" data-testid="text-hypothesis-criteria">{hypothesis.successCriteria}</p>
              ) : (
                <p className="text-muted-foreground italic">No success criteria documented.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {hypothesis.aiSuggestion && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ai flex items-center gap-2">
              <Sparkles className="size-4" /> AI Generated Suggestion
            </h3>
            <div
              className="bg-ai/5 border border-ai/20 p-4 rounded-lg text-sm whitespace-pre-wrap leading-relaxed"
              data-testid="saved-ai-suggestion"
            >
              <div className="flex items-start gap-2 mb-2 text-xs text-ai/80">
                <ShieldAlert className="size-4 shrink-0" />
                <p>This statement was generated by AI and saved as a reference. It is not considered validated evidence.</p>
              </div>
              <p className="font-medium">{hypothesis.aiSuggestion}</p>
            </div>
          </div>
        )}

        {hypothesis.notes && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Notes</h3>
            <div className="bg-muted/30 p-4 rounded-lg text-sm whitespace-pre-wrap leading-relaxed" data-testid="text-hypothesis-notes">
              {hypothesis.notes}
            </div>
          </div>
        )}

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Idea Context</h3>
          {productIdea ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="container-idea-context">
              <Card className="bg-muted/10 border-dashed">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground">Problem & Solution</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 text-sm space-y-3">
                  <div>
                    <span className="font-medium text-xs uppercase text-muted-foreground block mb-0.5">Problem</span>
                    {productIdea.problemStatement || productIdea.customerProblem || <span className="italic opacity-50">Not specified</span>}
                  </div>
                  <div>
                    <span className="font-medium text-xs uppercase text-muted-foreground block mb-0.5">Solution</span>
                    {productIdea.suggestedSolution || <span className="italic opacity-50">Not specified</span>}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/10 border-dashed">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground">Prioritization & Evidence</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 text-sm space-y-3">
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MessageSquare className="size-4" />
                      <span className="font-medium text-foreground">{productIdea.relatedFeedbackCount}</span> feedback
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Signal className="size-4" />
                      <span className="font-medium text-foreground">{productIdea.relatedSignalCount}</span> signals
                    </div>
                  </div>
                  {prioritization?.analysisAvailable && (
                    <div className="space-y-2 pt-2 border-t border-dashed">
                      {prioritization.moscowCategory && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">MoSCoW</span>
                          <span className="font-medium capitalize">{prioritization.moscowCategory.replace('_', ' ')}</span>
                        </div>
                      )}
                      {prioritization.riceScore !== null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">RICE Score</span>
                          <span className="font-medium">{prioritization.riceScore}</span>
                        </div>
                      )}
                      {prioritization.iceScore !== null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ICE Score</span>
                          <span className="font-medium">{prioritization.iceScore}</span>
                        </div>
                      )}
                      {prioritization.weightedScore !== null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Weighted Score</span>
                          <span className="font-medium">{prioritization.weightedScore}</span>
                        </div>
                      )}
                      {prioritization.overallPriority !== null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Overall Priority</span>
                          <span className="font-medium">{prioritization.overallPriority}</span>
                        </div>
                      )}
                      {prioritization.engineeringEffort !== null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Engineering Effort</span>
                          <span className="font-medium">
                            {prioritization.engineeringEffort} points
                          </span>
                        </div>
                      )}
                      {prioritization.businessValue && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Business Value</span>
                          <span className="text-right font-medium">
                            {prioritization.businessValue}
                          </span>
                        </div>
                      )}
                      {prioritization.customerImpact && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Impact</span>
                          <span className="font-medium capitalize">{prioritization.customerImpact.replace('_', ' ')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Context not available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
