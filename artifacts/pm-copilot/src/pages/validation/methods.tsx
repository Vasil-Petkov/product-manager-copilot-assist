import { BookOpen, AlertCircle, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpTooltip } from "@/components/help-tooltip";
import { Badge } from "@/components/ui/badge";
import { useListValidationMethods } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function ValidationMethods() {
  const { data: methods, isLoading, isError, refetch } = useListValidationMethods();

  return (
    <div className="p-8 max-w-[1200px] mx-auto w-full space-y-8 animate-in fade-in">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="size-8 text-primary" />
          Validation Methods
          <HelpTooltip
            purpose="Explore validation techniques, understand when to use them, and select the most appropriate method for your product question."
            bullets={[
              "Browse a curated library of validation methods",
              "Compare methods by effort, duration, and evidence strength",
              "Use a method to start a structured experiment plan",
            ]}
          />
        </h1>
        <p className="text-muted-foreground max-w-xl">
          Choose the right validation technique for each hypothesis — from quick smoke tests to
          in-depth user research — and understand when to use each one.
        </p>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="flex flex-col">
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-1/2 mb-2" />
                <Skeleton className="h-4 w-1/4" />
              </CardHeader>
              <CardContent className="space-y-3 flex-1 flex flex-col">
                <Skeleton className="h-16 w-full" />
                <div className="mt-auto pt-4 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <div className="p-8 border rounded-lg border-dashed text-center flex flex-col items-center justify-center space-y-4">
          <AlertCircle className="size-10 text-muted-foreground" />
          <p className="font-medium text-lg">Failed to load methods</p>
          <Button onClick={() => refetch()} variant="outline">Retry</Button>
        </div>
      ) : methods?.length === 0 ? (
        <div className="p-8 border rounded-lg border-dashed text-center flex flex-col items-center justify-center space-y-4">
          <BookOpen className="size-10 text-muted-foreground" />
          <p className="font-medium text-lg">No methods available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {methods?.map((method) => (
            <Card key={method.key} className="flex flex-col transition-all hover:shadow-md hover:border-primary/30 group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">
                    {method.name}
                  </CardTitle>
                  <Badge variant="secondary" className="capitalize shrink-0">
                    {method.category.replace('_', ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                  {method.summary}
                </p>
                <div className="text-xs space-y-1 mb-2">
                  <span className="font-semibold uppercase tracking-wider text-muted-foreground">Best For</span>
                  <p className="text-foreground/80 leading-relaxed">{method.bestFor}</p>
                </div>
                <div className="space-y-2 mt-auto text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Effort</span>
                    <span className="font-medium capitalize">{method.effort}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Evidence Strength</span>
                    <span className="font-medium capitalize">{method.evidenceStrength}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Default Duration</span>
                    <span className="font-medium">{method.defaultDurationDays} days</span>
                  </div>
                </div>
                <div className="pt-4">
                  <Button asChild className="w-full" variant="outline">
                    <Link href={`/validation/experiments/new?methodKey=${method.key}`}>
                      <Target className="size-4 mr-2" />
                      Design Experiment
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
