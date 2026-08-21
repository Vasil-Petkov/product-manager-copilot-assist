import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Target, ArrowLeft, FlaskConical, BookOpen, AlertCircle, MessageSquare, Signal, Sparkles, Loader2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage 
} from "@/components/ui/form";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import {
  getListValidationExperimentsQueryKey,
  useAssistValidationExperimentContent,
  useCreateValidationExperiment,
  useListValidationHypotheses,
  useListValidationMethods,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const formSchema = z.object({
  name: z.string().min(1, "Experiment name is required").max(300),
  hypothesisId: z.coerce.number().min(1, "Hypothesis is required"),
  methodKey: z.string().min(1, "Method is required"),
  setup: z.string().optional(),
  targetAudience: z.string().optional(),
  successMeasures: z.string().optional(),
  plannedStartDate: z.string().optional(),
  plannedEndDate: z.string().optional(),
  status: z.enum(["draft", "planned"]).default("draft"),
});

type FormValues = z.infer<typeof formSchema>;
type AiField = "setup" | "successMeasures";
type AiAction = "write" | "improve";

export default function NewValidationExperiment() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [initialHypothesisId, setInitialHypothesisId] = useState<number | undefined>();
  const [initialMethodKey, setInitialMethodKey] = useState<string | undefined>();
  const [pendingReplacement, setPendingReplacement] = useState<AiField | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hypId = params.get("hypothesisId");
    const mKey = params.get("methodKey");
    if (hypId) setInitialHypothesisId(Number(hypId));
    if (mKey) setInitialMethodKey(mKey);
  }, []);

  const {
    data: methods,
    isLoading: isLoadingMethods,
    isError: isMethodsError,
    refetch: refetchMethods,
  } = useListValidationMethods();
  const {
    data: hypotheses,
    isLoading: isLoadingHypotheses,
    isError: isHypothesesError,
    refetch: refetchHypotheses,
  } = useListValidationHypotheses({ includeArchived: false });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      setup: "",
      targetAudience: "",
      successMeasures: "",
      status: "draft",
      plannedStartDate: "",
      plannedEndDate: "",
    },
  });

  useEffect(() => {
    if (initialHypothesisId && !form.getValues("hypothesisId")) {
      form.setValue("hypothesisId", initialHypothesisId);
    }
    if (initialMethodKey && !form.getValues("methodKey")) {
      form.setValue("methodKey", initialMethodKey);
    }
  }, [initialHypothesisId, initialMethodKey, form]);

  const selectedHypothesis = hypotheses?.find(
    (hypothesis) => hypothesis.id === form.watch("hypothesisId"),
  );
  const selectedMethodKey = form.watch("methodKey") || initialMethodKey || "";

  const createMutation = useCreateValidationExperiment({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Experiment created successfully" });
        queryClient.invalidateQueries({ queryKey: getListValidationExperimentsQueryKey() });
        setLocation(`/validation/experiments/${data.id}`);
      },
      onError: () => {
        toast({ title: "Failed to create experiment", variant: "destructive" });
      }
    }
  });

  const aiMutation = useAssistValidationExperimentContent({
    mutation: {
      onSuccess: (response, variables) => {
        form.setValue(variables.data.field, response.text, {
          shouldDirty: true,
          shouldTouch: true,
        });
      },
      onError: () => {
        toast({
          title: "AI assistance is temporarily unavailable",
          description: "Your current draft has not been changed.",
          variant: "destructive",
        });
      },
    },
  });

  const setupValue = form.watch("setup") ?? "";
  const successMeasuresValue = form.watch("successMeasures") ?? "";

  function generateAiContent(field: AiField, action: AiAction) {
    const values = form.getValues();
    const existingText = values[field]?.trim() ?? "";
    if (!selectedMethodKey) {
      toast({
        title: "Select a validation method first",
        description: "AI assistance uses the selected method to create a useful draft.",
        variant: "destructive",
      });
      return;
    }
    if (action === "improve" && !existingText) return;

    aiMutation.mutate({
      data: {
        field,
        action,
        ...(values.hypothesisId ? { hypothesisId: values.hypothesisId } : {}),
        methodKey: selectedMethodKey,
        targetAudience: values.targetAudience?.trim() || null,
        setup: values.setup?.trim() || null,
        successMeasures: values.successMeasures?.trim() || null,
        existingText: existingText || null,
      },
    });
  }

  function handleAiAction(field: AiField, action: AiAction) {
    const currentText = form.getValues(field)?.trim() ?? "";
    if (action === "write" && currentText) {
      setPendingReplacement(field);
      return;
    }
    generateAiContent(field, action);
  }

  function AiAssistMenu({ field, hasText }: { field: AiField; hasText: boolean }) {
    const isGenerating = aiMutation.isPending;
    const firstAction: AiAction = hasText ? "improve" : "write";
    const secondAction: AiAction = hasText ? "write" : "improve";
    const labels: Record<AiAction, string> = { write: "Write", improve: "Improve" };

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-primary"
            aria-label={`AI assist with ${field === "setup" ? "Experiment Setup" : "Success Measures"}`}
            disabled={isGenerating}
          >
            {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {[firstAction, secondAction].map((action) => (
            <DropdownMenuItem
              key={action}
              disabled={isGenerating || (action === "improve" && !hasText)}
              onSelect={() => handleAiAction(field, action)}
              className={action === firstAction ? "font-medium text-primary" : undefined}
            >
              {action === "write" ? <Sparkles /> : <PenLine />}
              {labels[action]}
              {action === "improve" && !hasText ? " — add text first" : ""}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function onSubmit(values: FormValues) {
    createMutation.mutate({
      data: {
        ...values,
        plannedStartDate: values.plannedStartDate || null,
        plannedEndDate: values.plannedEndDate || null,
      }
    });
  }

  return (
    <div className="p-8 max-w-[800px] mx-auto w-full space-y-8 animate-in fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/validation/methods">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="size-6 text-primary" />
            Design Experiment
          </h1>
          <p className="text-muted-foreground text-sm">
            Set up a new validation experiment to test a hypothesis.
          </p>
        </div>
      </div>

      {(isMethodsError || isHypothesesError) ? (
        <Card className="border-destructive/30">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="size-10 text-destructive mx-auto" />
            <div>
              <p className="font-semibold">The experiment form needs current validation data</p>
              <p className="text-sm text-muted-foreground mt-1">
                Retry loading the methods and hypotheses before creating a plan.
              </p>
            </div>
            <div className="flex justify-center gap-2">
              {isMethodsError && <Button variant="outline" onClick={() => refetchMethods()}>Retry methods</Button>}
              {isHypothesesError && <Button variant="outline" onClick={() => refetchHypotheses()}>Retry hypotheses</Button>}
            </div>
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardContent className="p-6 md:p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Experiment Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Landing Page Waitlist Test" {...field} />
                    </FormControl>
                    <FormDescription>A clear, recognizable name for this test.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="hypothesisId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <FlaskConical className="size-4 text-muted-foreground" />
                        Target Hypothesis
                      </FormLabel>
                      <Select
                        disabled={isLoadingHypotheses}
                        onValueChange={(val) => field.onChange(Number(val))} 
                        value={field.value?.toString() || ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a hypothesis to test" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {hypotheses?.map((h) => (
                            <SelectItem key={h.id} value={h.id.toString()}>
                              {h.statement.substring(0, 60)}{h.statement.length > 60 ? "..." : ""}
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
                  name="methodKey"
                  render={() => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <BookOpen className="size-4 text-muted-foreground" />
                        Validation Method
                      </FormLabel>
                      <div className="flex min-h-10 items-center rounded-md border bg-muted/30 px-3 text-sm font-medium">
                        {methods?.find((method) => method.key === selectedMethodKey)?.name
                          ?? (initialMethodKey ? "Loading selected method…" : "Select a method from the Method Library")}
                      </div>
                      {!initialMethodKey && (
                        <FormDescription>
                          <Link className="text-primary hover:underline" href="/validation/methods">
                            Return to Validation Methods to choose a method.
                          </Link>
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {selectedHypothesis && (
                <Card className="bg-muted/20 border-dashed">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Linked context</CardTitle>
                    <CardDescription>
                      This existing Product Idea and prioritization context stays read-only in the experiment plan.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">Hypothesis</p>
                      <p className="font-medium">{selectedHypothesis.statement}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">Product Idea</p>
                        <p>{selectedHypothesis.productIdea.title}</p>
                      </div>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <span className="flex items-center gap-1.5"><MessageSquare className="size-4" /> {selectedHypothesis.productIdea.relatedFeedbackCount} feedback</span>
                        <span className="flex items-center gap-1.5"><Signal className="size-4" /> {selectedHypothesis.productIdea.relatedSignalCount} signals</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="planned">Planned</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="plannedStartDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="plannedEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="targetAudience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Audience</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Who are we testing this with? E.g., '10 existing enterprise customers who requested this feature'" 
                        className="resize-none h-20"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="setup"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Experiment Setup</FormLabel>
                      <AiAssistMenu field="setup" hasText={Boolean(setupValue.trim())} />
                    </div>
                    <FormControl>
                      <Textarea 
                        placeholder="How will this experiment be conducted? Describe the steps, tools, and assets needed." 
                        className="resize-none h-24"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="successMeasures"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Success Measures</FormLabel>
                      <AiAssistMenu field="successMeasures" hasText={Boolean(successMeasuresValue.trim())} />
                    </div>
                    <FormControl>
                      <Textarea 
                        placeholder="What specific metrics or signals will prove or disprove the hypothesis? E.g., '30% conversion rate on the waitlist'" 
                        className="resize-none h-20"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" asChild>
                  <Link href="/validation/methods">Cancel</Link>
                </Button>
                <Button type="submit" disabled={createMutation.isPending || isLoadingMethods || isLoadingHypotheses}>
                  {createMutation.isPending ? "Creating..." : "Create Experiment"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      )}
      <AlertDialog open={pendingReplacement !== null} onOpenChange={(open) => !open && setPendingReplacement(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the current content?</AlertDialogTitle>
            <AlertDialogDescription>
              Write will replace the current content with an AI draft. You can still edit the new text afterward.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingReplacement(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const field = pendingReplacement;
                setPendingReplacement(null);
                if (field) generateAiContent(field, "write");
              }}
            >
              Replace with AI draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
