import { useState } from "react";
import { DocumentType, useListOpportunities, useGenerateDocument, getListDocumentsQueryKey, useGetDocumentContext, getGetDocumentContextQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bot, Loader2, Sparkles, AlertCircle, FileText, ChevronRight, CheckCircle2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function DocumentWizard({ type, onCancel, onSuccess }: { type: DocumentType, onCancel: () => void, onSuccess: (id: number) => void }) {
  const { data: opportunities, isLoading: isLoadingOpp } = useListOpportunities();
  const [selectedOppId, setSelectedOppId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: documentContext, isLoading: isLoadingContext, isError: isErrorContext, refetch: refetchContext } = useGetDocumentContext(
    selectedOppId as number,
    type as any,
    {
      query: {
        enabled: Boolean(selectedOppId),
        queryKey: getGetDocumentContextQueryKey(selectedOppId as number, type as any)
      }
    }
  );

  const generateDoc = useGenerateDocument({
    mutation: {
      onSuccess: (data) => {
        trackEvent("document_ai_generation_completed", { document_type: type, status: "success" });
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        onSuccess(data.id);
        toast({ title: "Draft Generated Successfully" });
      },
      onError: (error) => {
        trackEvent("document_ai_generation_failed", { document_type: type });
        toast({
          title: "Generation Failed",
          description: "An error occurred while generating the document. Please try again.",
          variant: "destructive"
        });
      }
    }
  });

  const handleGenerate = () => {
    if (!selectedOppId) return;
    trackEvent("document_ai_generation_started", { document_type: type });
    generateDoc.mutate({ data: { productIdeaId: selectedOppId, documentType: type } });
  };

  const hasContextDetails = documentContext?.productIdea;
  const opp = documentContext?.productIdea;
  const ev = documentContext?.evidenceSummary;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>Documentation</span>
            <ChevronRight className="size-3" />
            <span className="text-foreground uppercase tracking-wide font-medium">{type.replace(/_/g, ' ')}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Create Document</h1>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Select Product Idea</CardTitle>
              <CardDescription>Choose the foundational idea for this document.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingOpp ? (
                <div className="h-10 w-full animate-pulse bg-muted rounded-md" />
              ) : (
                <Select
                  value={selectedOppId?.toString() || ""}
                  onValueChange={(val) => {
                    setSelectedOppId(Number(val));
                    trackEvent("document_product_idea_selected", { document_type: type });
                  }}
                  disabled={generateDoc.isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an opportunity..." />
                  </SelectTrigger>
                  <SelectContent>
                    {opportunities?.map(opp => (
                      <SelectItem key={opp.id} value={opp.id.toString()}>
                        {opp.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          <Card className="border-ai/20 bg-ai/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="size-5 text-ai" />
                2. Generate with AI
              </CardTitle>
              <CardDescription>
                AI will use the selected Product Idea to draft a highly contextual {type.toUpperCase()}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-full">
                    <Button
                      className="w-full bg-ai hover:bg-ai/90 text-ai-foreground"
                      onClick={handleGenerate}
                      disabled={!selectedOppId || generateDoc.isPending || isLoadingContext || !documentContext}
                    >
                      {generateDoc.isPending ? (
                        <>
                          <Loader2 className="size-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-4 mr-2" />
                          Generate Draft
                        </>
                      )}
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Generate a comprehensive document draft using AI.</p>
                </TooltipContent>
              </Tooltip>

              {generateDoc.isError && (
                <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md flex gap-2 items-start">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <div className="flex flex-col">
                    <span className="font-semibold">Generation Failed</span>
                    <Button variant="link" size="sm" className="h-auto p-0 justify-start" onClick={handleGenerate}>
                      Retry Generation
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="border-b bg-muted/30 pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="size-5 text-muted-foreground" />
                Context Review
              </CardTitle>
              <CardDescription>
                The AI will use these details to write the document.
              </CardDescription>
            </CardHeader>
            <ScrollArea className="flex-1">
              <CardContent className="p-6">
                {!selectedOppId ? (
                  <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                    <FileText className="size-12 mb-4 opacity-20" />
                    <p>Select a product idea to preview the context.</p>
                  </div>
                ) : isLoadingContext ? (
                  <div className="space-y-4 animate-pulse">
                    <div className="h-8 bg-muted rounded w-3/4 mb-6"></div>
                    <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
                    <div className="h-20 bg-muted rounded w-full mb-6"></div>
                    <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
                    <div className="h-20 bg-muted rounded w-full"></div>
                  </div>
                ) : isErrorContext ? (
                   <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                    <AlertCircle className="size-12 mb-4 opacity-20 text-destructive" />
                    <p className="mb-4">Failed to load document context.</p>
                    <Button variant="outline" onClick={() => refetchContext()}>Retry Loading Context</Button>
                  </div>
                ) : !hasContextDetails || !opp ? (
                   <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                    <AlertCircle className="size-12 mb-4 opacity-20" />
                    <p>Failed to load document context.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-2xl font-bold tracking-tight mb-3">{opp.title}</h3>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline" className="capitalize">{opp.status.replace(/_/g, ' ')}</Badge>
                        {opp.category && <Badge variant="secondary">{opp.category}</Badge>}
                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">{opp.sourceType.replace(/_/g, ' ')}</Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-lg">
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Signals</div>
                        <div className="text-lg font-bold">{ev?.signalsCount || 0}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Feedback</div>
                        <div className="text-lg font-bold">{ev?.stakeholderFeedbackCount || 0}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Meetings</div>
                        <div className="text-lg font-bold">{ev?.linkedMeetingsCount || 0}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Competitors</div>
                        <div className="text-lg font-bold">{ev?.linkedCompetitorsCount || 0}</div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {opp.description && (
                        <div>
                          <h4 className="font-semibold text-sm text-foreground mb-1.5 flex items-center gap-1.5"><Sparkles className="size-3.5 text-primary"/> Description</h4>
                          <p className="text-sm leading-relaxed text-muted-foreground">{opp.description}</p>
                        </div>
                      )}

                      {opp.problemStatement && (
                        <div>
                          <h4 className="font-semibold text-sm text-foreground mb-1.5 flex items-center gap-1.5"><AlertCircle className="size-3.5 text-destructive"/> Problem Statement</h4>
                          <p className="text-sm leading-relaxed text-muted-foreground">{opp.problemStatement}</p>
                        </div>
                      )}

                      {opp.customerProblem && (
                        <div>
                          <h4 className="font-semibold text-sm text-foreground mb-1.5 flex items-center gap-1.5"><FileText className="size-3.5 text-primary"/> Customer Problem</h4>
                          <p className="text-sm leading-relaxed text-muted-foreground">{opp.customerProblem}</p>
                        </div>
                      )}

                      {opp.rootCause && (
                        <div>
                          <h4 className="font-semibold text-sm text-foreground mb-1.5 flex items-center gap-1.5"><FileText className="size-3.5 text-primary"/> Root Cause</h4>
                          <p className="text-sm leading-relaxed text-muted-foreground">{opp.rootCause}</p>
                        </div>
                      )}

                      {opp.suggestedSolution && (
                        <div>
                          <h4 className="font-semibold text-sm text-foreground mb-1.5 flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-success"/> Suggested Solution</h4>
                          <p className="text-sm leading-relaxed text-muted-foreground">{opp.suggestedSolution}</p>
                        </div>
                      )}

                      {opp.businessValue && (
                        <div>
                          <h4 className="font-semibold text-sm text-foreground mb-1.5 flex items-center gap-1.5"><FileText className="size-3.5 text-primary"/> Business Value</h4>
                          <p className="text-sm leading-relaxed text-muted-foreground">{opp.businessValue}</p>
                        </div>
                      )}

                      {opp.customerValue && (
                        <div>
                          <h4 className="font-semibold text-sm text-foreground mb-1.5 flex items-center gap-1.5"><FileText className="size-3.5 text-primary"/> Customer Value</h4>
                          <p className="text-sm leading-relaxed text-muted-foreground">{opp.customerValue}</p>
                        </div>
                      )}

                      {opp.estimatedCustomerImpact && (
                        <div>
                          <h4 className="font-semibold text-sm text-foreground mb-1.5 flex items-center gap-1.5"><FileText className="size-3.5 text-primary"/> Estimated Customer Impact</h4>
                          <p className="text-sm leading-relaxed text-muted-foreground">{opp.estimatedCustomerImpact}</p>
                        </div>
                      )}

                      {opp.estimatedBusinessImpact && (
                        <div>
                          <h4 className="font-semibold text-sm text-foreground mb-1.5 flex items-center gap-1.5"><FileText className="size-3.5 text-primary"/> Estimated Business Impact</h4>
                          <p className="text-sm leading-relaxed text-muted-foreground">{opp.estimatedBusinessImpact}</p>
                        </div>
                      )}

                      {opp.dependencies && (
                        <div>
                          <h4 className="font-semibold text-sm text-foreground mb-1.5 flex items-center gap-1.5"><AlertCircle className="size-3.5 text-warning"/> Dependencies</h4>
                          <p className="text-sm leading-relaxed text-muted-foreground">{opp.dependencies}</p>
                        </div>
                      )}

                      {opp.openQuestions && opp.openQuestions.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm text-foreground mb-1.5 flex items-center gap-1.5"><AlertCircle className="size-3.5 text-primary"/> Open Questions</h4>
                          <ul className="text-sm leading-relaxed text-muted-foreground list-disc pl-5">
                            {opp.openQuestions.map((q, idx) => (
                              <li key={idx}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {opp.aiSummary && (
                        <div>
                          <h4 className="font-semibold text-sm text-foreground mb-1.5 flex items-center gap-1.5"><Bot className="size-3.5 text-ai"/> AI Summary</h4>
                          <p className="text-sm leading-relaxed text-muted-foreground">{opp.aiSummary}</p>
                        </div>
                      )}

                      {opp.aiRecommendation && (
                        <div>
                          <h4 className="font-semibold text-sm text-foreground mb-1.5 flex items-center gap-1.5"><Bot className="size-3.5 text-ai"/> AI Recommendation</h4>
                          <p className="text-sm leading-relaxed text-muted-foreground">{opp.aiRecommendation}</p>
                        </div>
                      )}
                    </div>

                    {documentContext.requiredSections && documentContext.requiredSections.length > 0 && (
                      <div className="pt-4 border-t">
                        <h4 className="font-semibold text-sm text-foreground mb-3">AI will generate these sections:</h4>
                        <div className="flex flex-wrap gap-2">
                          {documentContext.requiredSections.map(s => (
                             <Badge key={s} variant="outline" className="bg-muted/30 text-xs">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </ScrollArea>
          </Card>
        </div>
      </div>
    </div>
  );
}