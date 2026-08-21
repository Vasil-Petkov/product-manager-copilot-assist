import { useEffect, useRef } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Target, ArrowLeft, BookOpen, Calendar, Archive, Play, CheckCircle2, XCircle, AlertCircle, MessageSquare, Signal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage 
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { 
  useGetValidationExperiment, useUpdateValidationExperiment, useArchiveValidationExperiment,
  getGetValidationExperimentQueryKey, getListValidationExperimentsQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const formSchema = z.object({
  name: z.string().min(1, "Experiment name is required").max(300),
  methodKey: z.string().min(1, "Method is required"),
  setup: z.string().optional(),
  targetAudience: z.string().optional(),
  successMeasures: z.string().optional(),
  plannedStartDate: z.string().optional(),
  plannedEndDate: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ValidationExperimentDetail() {
  const [, params] = useRoute("/validation/experiments/:id");
  const id = Number(params?.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: experiment, isLoading, isError, refetch } = useGetValidationExperiment(id, {
    query: {
      enabled: !!id,
      queryKey: getGetValidationExperimentQueryKey(id)
    }
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      methodKey: "",
      setup: "",
      targetAudience: "",
      successMeasures: "",
      plannedStartDate: "",
      plannedEndDate: "",
    },
  });

  const initializedForId = useRef<number | null>(null);

  useEffect(() => {
    if (experiment && initializedForId.current !== id) {
      initializedForId.current = id;
      form.reset({
        name: experiment.name,
        methodKey: experiment.methodKey,
        setup: experiment.setup || "",
        targetAudience: experiment.targetAudience || "",
        successMeasures: experiment.successMeasures || "",
        plannedStartDate: experiment.plannedStartDate || "",
        plannedEndDate: experiment.plannedEndDate || "",
      });
    }
  }, [experiment, id, form]);

  const updateMutation = useUpdateValidationExperiment({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Experiment updated" });
        queryClient.setQueryData(getGetValidationExperimentQueryKey(id), data);
        queryClient.invalidateQueries({ queryKey: getListValidationExperimentsQueryKey() });
      },
      onError: () => {
        toast({ title: "Failed to update", variant: "destructive" });
      }
    }
  });

  const archiveMutation = useArchiveValidationExperiment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Experiment archived" });
        queryClient.invalidateQueries({ queryKey: getListValidationExperimentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetValidationExperimentQueryKey(id) });
         setLocation("/validation/methods");
      },
      onError: () => {
        toast({ title: "Failed to archive", variant: "destructive" });
      }
    }
  });

  function onSubmit(values: FormValues) {
    updateMutation.mutate({
      id,
      data: {
        name: values.name,
        methodKey: values.methodKey,
        setup: values.setup || null,
        targetAudience: values.targetAudience || null,
        successMeasures: values.successMeasures || null,
        plannedStartDate: values.plannedStartDate || null,
        plannedEndDate: values.plannedEndDate || null,
      }
    });
  }

  const handleStatusChange = (newStatus: "planned" | "running" | "completed" | "cancelled") => {
    updateMutation.mutate({ id, data: { status: newStatus } });
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-[1000px] mx-auto w-full space-y-6">
        <Skeleton className="h-8 w-1/4 mb-6" />
        <Skeleton className="h-12 w-2/3" />
        <div className="grid grid-cols-3 gap-6 pt-6">
          <div className="col-span-2 space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !experiment) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-muted-foreground">
        <Target className="size-10 mb-4 opacity-50" />
        <p className="text-lg font-medium">Failed to load experiment</p>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={() => refetch()}>
            <AlertCircle className="size-4 mr-2" /> Retry
          </Button>
          <Button variant="outline" asChild>
            <Link href="/validation/methods">Back to Validation Methods</Link>
          </Button>
        </div>
      </div>
    );
  }

  const statusColors = {
    draft: "bg-muted text-muted-foreground",
    planned: "bg-primary/10 text-primary border-primary/20",
    running: "bg-ai/10 text-ai border-ai/20",
    completed: "bg-success/10 text-success border-success/20",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const isArchived = !!experiment.archivedAt;

  return (
    <div className="p-8 max-w-[1200px] mx-auto w-full space-y-6 animate-in fade-in pb-24">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/validation/methods">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <Badge variant="outline" className={`capitalize ${statusColors[experiment.status as keyof typeof statusColors]}`}>
            {experiment.status}
          </Badge>
          {isArchived && <Badge variant="destructive">Archived</Badge>}
        </div>
        
        <div className="flex items-center gap-2">
          {!isArchived && experiment.status === "draft" && (
            <Button variant="outline" size="sm" onClick={() => handleStatusChange("planned")} disabled={updateMutation.isPending}>
              Mark as Planned
            </Button>
          )}
          {!isArchived && experiment.status === "planned" && (
            <Button variant="default" size="sm" onClick={() => handleStatusChange("running")} disabled={updateMutation.isPending}>
              <Play className="size-4 mr-2" /> Start Experiment
            </Button>
          )}
          {!isArchived && experiment.status === "running" && (
            <Button variant="default" size="sm" className="bg-success hover:bg-success/90" onClick={() => handleStatusChange("completed")} disabled={updateMutation.isPending}>
              <CheckCircle2 className="size-4 mr-2" /> Complete
            </Button>
          )}

          {!isArchived && ["draft", "planned", "running"].includes(experiment.status) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={updateMutation.isPending}
                >
                  <XCircle className="size-4 mr-2" /> Cancel
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel experiment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently move the experiment to Cancelled. It will remain available for historical reference.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep experiment</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => handleStatusChange("cancelled")}
                  >
                    Cancel experiment
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {!isArchived && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={archiveMutation.isPending}>
                  <Archive className="size-4 mr-2" />
                  Archive
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive experiment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Archived experiments are hidden from default views but retained for historical reference.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => archiveMutation.mutate({ id })}
                  >
                    Archive
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Details */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    Experiment Details
                    {form.formState.isDirty && (
                      <Badge variant="secondary" className="bg-warning/20 text-warning border-transparent">Unsaved Changes</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Experiment Name</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isArchived} className="font-semibold text-lg" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                    <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">Target hypothesis</p>
                    <p className="text-sm font-medium leading-relaxed">{experiment.hypothesis.statement}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                          {experiment.method.name}
                        </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Design & Setup</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="targetAudience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Audience</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            disabled={isArchived}
                            className="resize-none min-h-[100px]"
                            placeholder="Describe who you are testing with..."
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
                        <FormLabel>Experiment Setup</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            disabled={isArchived}
                            className="resize-none min-h-[120px]"
                            placeholder="Step-by-step plan for how to run this experiment..."
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
                        <FormLabel>Success Measures</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            disabled={isArchived}
                            className="resize-none min-h-[100px]"
                            placeholder="What constitutes success?"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Meta & Actions */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Timeline & Meta</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">Status</p>
                    <p className="text-sm capitalize">{experiment.status}</p>
                  </div>

                  <div className="space-y-4 pt-2">
                    <FormField
                      control={form.control}
                      name="plannedStartDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Calendar className="size-4 text-muted-foreground" />
                            Planned Start Date
                          </FormLabel>
                          <FormControl>
                            <Input disabled={isArchived} type="date" {...field} value={field.value || ""} />
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
                          <FormLabel className="flex items-center gap-2">
                            <Calendar className="size-4 text-muted-foreground" />
                            Planned End Date
                          </FormLabel>
                          <FormControl>
                            <Input disabled={isArchived} type="date" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="pt-4 border-t border-border/50 mt-4">
                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Owner</p>
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {experiment.owner?.name?.charAt(0) || "U"}
                      </div>
                      <span className="text-sm font-medium">{experiment.owner?.name || "Unknown"}</span>
                    </div>
                  </div>

                  <div className="space-y-1 pt-4 text-xs text-muted-foreground">
                    {experiment.startedAt && <p>Started: {format(new Date(experiment.startedAt), "PPp")}</p>}
                    {experiment.completedAt && <p>Completed: {format(new Date(experiment.completedAt), "PPp")}</p>}
                    <p>Created: {format(new Date(experiment.createdAt), "PPp")}</p>
                    <p>Last updated: {format(new Date(experiment.updatedAt), "PPp")}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/20 border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Linked Product Idea context</CardTitle>
                  <CardDescription>
                    Context is shown for planning only and is not recalculated by experiments.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">Product Idea</p>
                    <p className="font-medium">{experiment.hypothesis.productIdea.title}</p>
                  </div>
                  <div className="flex gap-4 text-muted-foreground">
                    <span className="flex items-center gap-1.5"><MessageSquare className="size-4" /> {experiment.hypothesis.productIdea.relatedFeedbackCount} feedback</span>
                    <span className="flex items-center gap-1.5"><Signal className="size-4" /> {experiment.hypothesis.productIdea.relatedSignalCount} signals</span>
                  </div>
                  {experiment.hypothesis.prioritization.analysisAvailable && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 border-t border-dashed text-xs">
                      {experiment.hypothesis.prioritization.moscowCategory && <p>MoSCoW <span className="font-medium capitalize">{experiment.hypothesis.prioritization.moscowCategory.replace("_", " ")}</span></p>}
                      {experiment.hypothesis.prioritization.riceScore !== null && <p>RICE <span className="font-medium">{experiment.hypothesis.prioritization.riceScore}</span></p>}
                      {experiment.hypothesis.prioritization.iceScore !== null && <p>ICE <span className="font-medium">{experiment.hypothesis.prioritization.iceScore}</span></p>}
                      {experiment.hypothesis.prioritization.weightedScore !== null && <p>Weighted <span className="font-medium">{experiment.hypothesis.prioritization.weightedScore}</span></p>}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {!isArchived && form.formState.isDirty && (
                <div className="sticky bottom-6 bg-card border rounded-lg p-4 shadow-lg flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">You have unsaved changes</span>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => form.reset()}>Discard</Button>
                    <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
          </div>
        </form>
      </Form>
    </div>
  );
}
