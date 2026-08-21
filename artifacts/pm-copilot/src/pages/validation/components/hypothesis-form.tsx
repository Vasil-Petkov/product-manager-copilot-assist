import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useGetValidationHypothesis,
  useCreateValidationHypothesis,
  useUpdateValidationHypothesis,
  useImproveHypothesisWithAi,
  useListValidationProductIdeas,
  useListOpportunities,
  getGetValidationHypothesisQueryKey,
  getListValidationHypothesesQueryKey,
  getListOpportunitiesQueryKey,
  HypothesisType,
  HypothesisStatus,
  type HypothesisAiSuggestion
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowLeft, Wand2, ShieldAlert, Sparkles, Check, MessageSquare, Signal } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link } from "wouter";

const formSchema = z.object({
  opportunityId: z.coerce.number().min(1, "Product Idea is required"),
  hypothesisType: z.nativeEnum(HypothesisType),
  statement: z.string().min(5, "Statement is required (at least 5 characters)"),
  assumption: z.string().nullable().optional(),
  successCriteria: z.string().nullable().optional(),
  status: z.nativeEnum(HypothesisStatus),
  notes: z.string().nullable().optional(),
  aiSuggestion: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const TEMPLATES = {
  problem: { type: "problem", statement: "We believe that [target audience] experiences [problem] when trying to [task].", assumption: "[Target audience] cares enough about [problem] to seek a solution.", successCriteria: "We will see [metric] reach [target] by [date]." },
  solution: { type: "solution", statement: "We believe that [solution] will solve [problem] for [target audience].", assumption: "[Solution] is feasible to build and solves the core problem.", successCriteria: "We will see a [percentage]% adoption rate among [segment]." },
  value: { type: "value", statement: "We believe that [target audience] will derive [specific value] from [feature].", assumption: "[Specific value] is a high priority for [target audience].", successCriteria: "User retention will increase by [percentage]%." },
  business: { type: "business", statement: "We believe that [initiative] will impact [business metric] by [amount].", assumption: "The cost of [initiative] will not exceed the return.", successCriteria: "[Business metric] will improve by [amount]." },
  pricing: { type: "pricing", statement: "We believe that [target audience] will pay [price] for [product/feature].", assumption: "The perceived value exceeds the [price].", successCriteria: "We will achieve a [percentage]% conversion rate at this price point." },
  custom: { type: "custom", statement: "", assumption: "", successCriteria: "" }
} as const;

export function HypothesisForm({ hypothesisId, onSave, onCancel }: { hypothesisId?: number, onSave: (id: number) => void, onCancel: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [aiSuggestion, setAiSuggestion] = useState<HypothesisAiSuggestion | null>(null);
  const [templateConfirmOpen, setTemplateConfirmOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<keyof typeof TEMPLATES | null>(null);

  const { data: hypothesis, isLoading: isLoadingHypothesis, isError: isHypothesisError, refetch: refetchHypothesis } = useGetValidationHypothesis(hypothesisId!, {
    query: {
      enabled: !!hypothesisId,
      queryKey: getGetValidationHypothesisQueryKey(hypothesisId!)
    }
  });

  // Product Discovery owns Product Ideas. The selector reads that same endpoint
  // so every available idea can be attached to a hypothesis.
  const {
    data: productIdeas,
    isLoading: isLoadingIdeas,
    isError: isIdeasError,
    refetch: refetchIdeas,
  } = useListOpportunities(
    { limit: 200 },
    { query: { queryKey: getListOpportunitiesQueryKey({ limit: 200 }), refetchOnMount: "always", staleTime: 0 } },
  );
  // Validation-specific context enriches the selected idea below; it is not the
  // source used to populate the selector.
  const {
    data: productIdeaContexts,
    isLoading: isLoadingIdeaContexts,
  } = useListValidationProductIdeas();

  const createMutation = useCreateValidationHypothesis();
  const updateMutation = useUpdateValidationHypothesis();
  const improveMutation = useImproveHypothesisWithAi();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      opportunityId: 0,
      hypothesisType: "problem",
      statement: "",
      assumption: "",
      successCriteria: "",
      status: "draft",
      notes: "",
      aiSuggestion: "",
    }
  });

  useEffect(() => {
    if (hypothesis) {
      form.reset({
        opportunityId: hypothesis.opportunityId,
        hypothesisType: hypothesis.hypothesisType,
        statement: hypothesis.statement,
        assumption: hypothesis.assumption || "",
        successCriteria: hypothesis.successCriteria || "",
        status: hypothesis.status,
        notes: hypothesis.notes || "",
        aiSuggestion: hypothesis.aiSuggestion || "",
      });
    }
  }, [hypothesis, form]);

  const applyTemplate = (type: keyof typeof TEMPLATES) => {
    const template = TEMPLATES[type];
    form.setValue("hypothesisType", template.type);
    form.setValue("statement", template.statement);
    form.setValue("assumption", template.assumption);
    form.setValue("successCriteria", template.successCriteria);
    form.setValue("aiSuggestion", null);
    setAiSuggestion(null);
  };

  const handleTemplateSelect = (type: keyof typeof TEMPLATES) => {
    const currentValues = form.getValues();
    const isDirty = currentValues.statement !== "" || currentValues.assumption !== "" || currentValues.successCriteria !== "";
    const isKnownTemplate = Object.values(TEMPLATES).some(t => 
      t.statement === currentValues.statement && 
      t.assumption === currentValues.assumption && 
      t.successCriteria === currentValues.successCriteria
    );

    if (isDirty && !isKnownTemplate) {
      setPendingTemplate(type);
      setTemplateConfirmOpen(true);
    } else {
      applyTemplate(type);
    }
  };

  const onSubmit = (data: FormValues) => {
    if (hypothesisId) {
      updateMutation.mutate({ id: hypothesisId, data }, {
        onSuccess: () => {
          toast({ title: "Hypothesis updated" });
          queryClient.invalidateQueries({ queryKey: getListValidationHypothesesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetValidationHypothesisQueryKey(hypothesisId) });
          onSave(hypothesisId);
        },
        onError: () => toast({ title: "Failed to update", variant: "destructive" })
      });
    } else {
      createMutation.mutate({ data }, {
        onSuccess: (res) => {
          toast({ title: "Hypothesis created" });
          queryClient.invalidateQueries({ queryKey: getListValidationHypothesesQueryKey() });
          onSave(res.id);
        },
        onError: () => toast({ title: "Failed to create", variant: "destructive" })
      });
    }
  };

  const handleImproveWithAi = () => {
    const values = form.getValues();
    if (
      !values.opportunityId ||
      !productIdeas?.some((idea) => idea.id === values.opportunityId)
    ) {
      toast({ title: "Select a Product Idea first", description: "AI needs the context of an idea to improve the hypothesis." });
      return;
    }
    if (!values.statement || values.statement.length < 5) {
      toast({ title: "Write a statement first", description: "AI needs some context to improve." });
      return;
    }
    
    improveMutation.mutate({
      data: {
        opportunityId: values.opportunityId,
        hypothesisType: values.hypothesisType,
        statement: values.statement,
        assumption: values.assumption,
        successCriteria: values.successCriteria,
      }
    }, {
      onSuccess: (res) => {
        setAiSuggestion(res);
        toast({ title: "AI suggestions ready" });
      },
      onError: () => {
        toast({ title: "AI improvement failed", description: "Your original text was kept.", variant: "destructive" });
      }
    });
  };

  const applyAiSuggestion = () => {
    if (aiSuggestion) {
      form.setValue("statement", aiSuggestion.suggestedStatement);
      if (aiSuggestion.suggestedAssumption) form.setValue("assumption", aiSuggestion.suggestedAssumption);
      if (aiSuggestion.suggestedSuccessCriteria) form.setValue("successCriteria", aiSuggestion.suggestedSuccessCriteria);
      form.setValue("aiSuggestion", aiSuggestion.suggestedStatement);
      setAiSuggestion(null);
      toast({ title: "Suggestions applied", description: "You can edit them further." });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isLoading = (!!hypothesisId && isLoadingHypothesis) || isLoadingIdeas || isLoadingIdeaContexts;

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isHypothesisError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <ShieldAlert className="size-10 mb-4 opacity-50" />
        <p className="text-lg font-medium">Failed to load hypothesis</p>
        <Button variant="outline" onClick={() => refetchHypothesis()} className="mt-4" data-testid="button-retry-hypothesis">Retry</Button>
      </div>
    );
  }

  if (isIdeasError) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <ShieldAlert className="mb-4 size-10 opacity-50" />
        <p className="text-lg font-medium text-foreground">Failed to load Product Ideas</p>
        <p className="mt-1 max-w-md text-sm">
          Product Idea context is required before a hypothesis can be created or edited.
        </p>
        <Button
          variant="outline"
          onClick={() => refetchIdeas()}
          className="mt-4"
          data-testid="button-retry-ideas"
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!hypothesisId && productIdeas?.length === 0) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground"
        data-testid="empty-product-ideas"
      >
        <ShieldAlert className="mb-4 size-10 opacity-50" />
        <p className="text-lg font-medium text-foreground">Create a Product Idea first</p>
        <p className="mt-1 max-w-md text-sm">
          Every hypothesis must be attached to an owned Product Idea so its discovery and
          prioritization context stays connected.
        </p>
        <Link href="/discovery/opportunities">
          <a className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
            Go to Product Ideas
          </a>
        </Link>
      </div>
    );
  }

  const selectedIdeaId = form.watch("opportunityId");
  const selectedIdea = productIdeaContexts?.find(idea => idea.id === selectedIdeaId);

  return (
    <div className="flex flex-col h-full animate-in fade-in max-w-4xl mx-auto pb-20">
      <AlertDialog open={templateConfirmOpen} onOpenChange={setTemplateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overwrite current draft?</AlertDialogTitle>
            <AlertDialogDescription>
              Applying this template will replace the text you've already written in the Statement, Assumption, and Success Criteria fields.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingTemplate) applyTemplate(pendingTemplate);
              setPendingTemplate(null);
            }}>
              Yes, overwrite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="p-6 md:p-8 border-b bg-card sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onCancel} className="shrink-0" data-testid="button-cancel-form">
            <ArrowLeft className="size-4" />
          </Button>
          <h2 className="text-xl font-bold tracking-tight">
            {hypothesisId ? "Edit Hypothesis" : "New Hypothesis"}
          </h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isSaving} data-testid="button-cancel-save">Cancel</Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={isSaving} data-testid="button-save-hypothesis">
            {isSaving && <Loader2 className="size-4 mr-2 animate-spin" />}
            {hypothesisId ? "Save Changes" : "Create"}
          </Button>
        </div>
      </div>

      <div className="p-6 md:p-8 overflow-y-auto">
        <Form {...form}>
          <form className="space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="opportunityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Idea</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      value={field.value ? String(field.value) : ""}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-opportunity">
                          <SelectValue placeholder="Select an idea to attach to..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {productIdeas?.map((idea) => (
                          <SelectItem key={idea.id} value={String(idea.id)}>
                            {idea.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hypothesisType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hypothesis Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-hypothesis-type">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="problem">Problem (Do they have this issue?)</SelectItem>
                        <SelectItem value="solution">Solution (Does this solve it?)</SelectItem>
                        <SelectItem value="value">Value (Will they use it?)</SelectItem>
                        <SelectItem value="business">Business (Can we support it?)</SelectItem>
                        <SelectItem value="pricing">Pricing (Will they pay?)</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {selectedIdea && (
              <Card className="bg-muted/30 border-dashed" data-testid="container-idea-context-form">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    Idea Context
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 text-sm space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      {selectedIdea.problemStatement && (
                        <div>
                          <span className="font-medium text-xs uppercase text-muted-foreground block mb-0.5">Problem</span>
                          {selectedIdea.problemStatement}
                        </div>
                      )}
                      {selectedIdea.suggestedSolution && (
                        <div>
                          <span className="font-medium text-xs uppercase text-muted-foreground block mb-0.5">Solution</span>
                          {selectedIdea.suggestedSolution}
                        </div>
                      )}
                    </div>
                    <div className="space-y-3 border-t md:border-t-0 md:border-l border-dashed pt-3 md:pt-0 md:pl-4">
                      <div className="flex gap-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MessageSquare className="size-4" />
                          <span className="font-medium text-foreground">{selectedIdea.relatedFeedbackCount}</span> feedback
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Signal className="size-4" />
                          <span className="font-medium text-foreground">{selectedIdea.relatedSignalCount}</span> signals
                        </div>
                      </div>
                      {selectedIdea.prioritization?.analysisAvailable && (
                        <div className="space-y-1.5 pt-1 text-xs">
                          {selectedIdea.prioritization.moscowCategory && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">MoSCoW</span>
                              <span className="font-medium capitalize">{selectedIdea.prioritization.moscowCategory.replace('_', ' ')}</span>
                            </div>
                          )}
                          {selectedIdea.prioritization.riceScore !== null && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">RICE Score</span>
                              <span className="font-medium">{selectedIdea.prioritization.riceScore}</span>
                            </div>
                          )}
                          {selectedIdea.prioritization.iceScore !== null && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">ICE Score</span>
                              <span className="font-medium">{selectedIdea.prioritization.iceScore}</span>
                            </div>
                          )}
                          {selectedIdea.prioritization.weightedScore !== null && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Weighted Score</span>
                              <span className="font-medium">{selectedIdea.prioritization.weightedScore}</span>
                            </div>
                          )}
                          {selectedIdea.prioritization.engineeringEffort !== null && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Engineering Effort</span>
                              <span className="font-medium">
                                {selectedIdea.prioritization.engineeringEffort} points
                              </span>
                            </div>
                          )}
                          {selectedIdea.prioritization.businessValue && (
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">Business Value</span>
                              <span className="text-right font-medium">
                                {selectedIdea.prioritization.businessValue}
                              </span>
                            </div>
                          )}
                          {selectedIdea.prioritization.customerImpact && (
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">Customer Impact</span>
                              <span className="text-right font-medium">
                                {selectedIdea.prioritization.customerImpact}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <Label>Starter Templates</Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => handleTemplateSelect('problem')} data-testid="button-template-problem">Problem</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => handleTemplateSelect('solution')} data-testid="button-template-solution">Solution</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => handleTemplateSelect('value')} data-testid="button-template-value">Value</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => handleTemplateSelect('business')} data-testid="button-template-business">Business</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => handleTemplateSelect('pricing')} data-testid="button-template-pricing">Pricing</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleTemplateSelect('custom')} data-testid="button-template-custom">Write from scratch</Button>
              </div>
            </div>

            {aiSuggestion && (
              <Card
                className="border-ai bg-ai/5 shadow-md shadow-ai/10 animate-in slide-in-from-top-4"
                data-testid="panel-ai-suggestion"
              >
                <CardHeader className="pb-3 border-b border-ai/10">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-ai">
                    <Sparkles className="size-4" /> AI Suggested Improvements
                  </CardTitle>
                  <CardDescription className="text-xs flex items-start gap-1.5 text-ai/80 pt-1">
                    <ShieldAlert className="size-3.5 mt-0.5 shrink-0" />
                    Review suggestions carefully. AI can hallucinate. You must explicitly apply these changes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4 text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Original</p>
                      <div className="p-3 bg-background rounded border opacity-70">
                        {aiSuggestion.originalStatement}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="font-semibold text-ai uppercase text-[10px] tracking-wider">Suggested Statement</p>
                      <div className="p-3 bg-background rounded border border-ai/30 shadow-sm font-medium">
                        {aiSuggestion.suggestedStatement}
                      </div>
                    </div>
                  </div>
                  
                  {(aiSuggestion.suggestedAssumption || aiSuggestion.suggestedSuccessCriteria) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      {aiSuggestion.suggestedAssumption && (
                        <div className="space-y-2">
                          <p className="font-semibold text-ai uppercase text-[10px] tracking-wider flex justify-between">
                            Suggested Assumption
                            {aiSuggestion.assumptionLabels && aiSuggestion.assumptionLabels.length > 0 && (
                              <span className="flex gap-1">
                                {aiSuggestion.assumptionLabels.map((label, index) => (
                                  <span
                                    key={`${index}-${label}`}
                                    className="text-[9px] bg-ai/10 px-1 rounded"
                                    data-testid={`label-ai-assumption-${index}`}
                                  >
                                    {label}
                                  </span>
                                ))}
                              </span>
                            )}
                          </p>
                          <div className="p-3 bg-background rounded border border-ai/30 shadow-sm text-xs">
                            {aiSuggestion.suggestedAssumption}
                          </div>
                        </div>
                      )}
                      {aiSuggestion.suggestedSuccessCriteria && (
                        <div className="space-y-2">
                          <p className="font-semibold text-ai uppercase text-[10px] tracking-wider">Suggested Success Criteria</p>
                          <div className="p-3 bg-background rounded border border-ai/30 shadow-sm text-xs">
                            {aiSuggestion.suggestedSuccessCriteria}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAiSuggestion(null)} data-testid="button-discard-ai">
                      Discard
                    </Button>
                    <Button type="button" size="sm" className="bg-ai hover:bg-ai/90 text-ai-foreground" onClick={applyAiSuggestion} data-testid="button-apply-ai">
                      <Check className="size-4 mr-1.5" />
                      Apply Suggestions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-6">
              <FormField
                control={form.control}
                name="statement"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Hypothesis Statement *</FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs text-ai hover:text-ai border-ai/20 hover:bg-ai/10"
                        onClick={handleImproveWithAi}
                        disabled={improveMutation.isPending || !form.watch("statement") || aiSuggestion !== null}
                        data-testid="button-improve-ai"
                      >
                        {improveMutation.isPending ? (
                          <Loader2 className="size-3 mr-1.5 animate-spin" />
                        ) : (
                          <Wand2 className="size-3 mr-1.5" />
                        )}
                        Improve with AI
                      </Button>
                    </div>
                    <FormControl>
                      <Textarea 
                        placeholder="e.g. We believe that adding a dark mode will increase session length by 15%." 
                        className="resize-none h-24 text-base" 
                        {...field} 
                        data-testid="input-hypothesis-statement"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="assumption"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Riskiest Assumption</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="What must be true for this to work?" 
                          className="resize-none h-24" 
                          {...field}
                          value={field.value || ""} 
                          data-testid="input-hypothesis-assumption"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="successCriteria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Success Criteria</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="How will we measure success?" 
                          className="resize-none h-24" 
                          {...field}
                          value={field.value || ""} 
                          data-testid="input-hypothesis-criteria"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-hypothesis-status">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="ready_for_validation">Ready for Validation</SelectItem>
                          <SelectItem value="in_validation">In Validation</SelectItem>
                          <SelectItem value="validated">Validated</SelectItem>
                          <SelectItem value="invalidated">Invalidated</SelectItem>
                          <SelectItem value="inconclusive">Inconclusive</SelectItem>
                          <SelectItem value="needs_more_validation">Needs More Validation</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Additional context or research..." 
                        className="resize-none h-32" 
                        {...field}
                        value={field.value || ""} 
                        data-testid="input-hypothesis-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
          </form>
        </Form>
      </div>
    </div>
  );
}
