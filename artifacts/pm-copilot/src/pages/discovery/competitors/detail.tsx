import { useRoute, Link, useLocation } from "wouter";
import { useGetCompetitor, useAnalyzeCompetitor, useListCompetitorReports, getGetCompetitorQueryKey, getListCompetitorReportsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Target, Globe, Building2, Brain, Activity, ShieldAlert, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const THREAT_COLORS = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
};

export default function CompetitorDetail() {
  const [, params] = useRoute("/discovery/competitors/:id");
  const id = parseInt(params?.id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: comp, isLoading: compLoading } = useGetCompetitor(id, {
    query: { enabled: !!id, queryKey: getGetCompetitorQueryKey(id) }
  });
  
  const { data: reports, isLoading: reportsLoading } = useListCompetitorReports(id, {
    query: { enabled: !!id, queryKey: getListCompetitorReportsQueryKey(id) }
  });

  const analyze = useAnalyzeCompetitor();

  const handleAnalyze = () => {
    analyze.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Analysis complete", description: "Market landscape analyzed." });
        queryClient.invalidateQueries({ queryKey: getGetCompetitorQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListCompetitorReportsQueryKey(id) });
      }
    });
  };

  if (compLoading) return <div className="p-8 space-y-6"><Skeleton className="h-20 w-full max-w-xl"/><Skeleton className="h-64 w-full"/></div>;
  if (!comp) return <div className="p-8 text-center text-muted-foreground">Competitor not found.</div>;

  return (
    <div className="p-8 max-w-[1200px] mx-auto w-full space-y-6 animate-in fade-in">
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-3 text-muted-foreground hover:text-foreground">
        <Link href="/discovery/competitors"><ArrowLeft className="mr-2 size-4" /> Back to Competitors</Link>
      </Button>

      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 bg-card p-6 rounded-xl border shadow-sm">
        <div className="space-y-4 flex-1">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Target className="size-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                {comp.name}
              </h1>
              {comp.website && (
                <a href={comp.website} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 w-fit mt-1">
                  <Globe className="size-3.5" /> {comp.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
          <p className="text-lg text-foreground/80 leading-relaxed max-w-3xl">{comp.description}</p>
          <div className="flex flex-wrap items-center gap-2">
            {comp.industry && <Badge variant="secondary" className="bg-secondary/50"><Building2 className="size-3 mr-1"/> {comp.industry}</Badge>}
            {comp.threatLevel && (
              <Badge variant="outline" className={THREAT_COLORS[comp.threatLevel.toLowerCase() as keyof typeof THREAT_COLORS] || ""}>
                {comp.threatLevel} Threat
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-3 shrink-0">
          <Button onClick={handleAnalyze} disabled={analyze.isPending} className="bg-ai text-ai-foreground hover:bg-ai/90 shadow-sm gap-2">
            <Brain className="size-4" /> {analyze.isPending ? "Running Scan..." : "Generate AI Intel Report"}
          </Button>
          {comp.lastAnalyzedAt && (
            <span className="text-xs text-muted-foreground">Last scanned: {format(new Date(comp.lastAnalyzedAt), 'MMM d, yyyy')}</span>
          )}
        </div>
      </header>

      <div className="space-y-6">
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2 mt-8">
          <Activity className="size-5 text-primary" /> Intelligence Timeline
        </h2>
        
        {reportsLoading ? (
          <div className="space-y-4">
             <Skeleton className="h-48 w-full" />
             <Skeleton className="h-48 w-full" />
          </div>
        ) : (!reports || reports.length === 0) ? (
          <Card className="border-dashed bg-transparent shadow-none">
            <CardContent className="p-12 text-center text-muted-foreground flex flex-col items-center">
              <Brain className="size-12 mb-4 text-muted-foreground/30" />
              <p>No intelligence reports generated yet.</p>
              <p className="text-sm mt-1">Run an AI scan to analyze their recent activity and features.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6 border-l-2 border-primary/20 ml-3 pl-6 relative">
            {reports.map((report, idx) => (
              <Card key={report.id} className="relative before:absolute before:size-4 before:-left-[33px] before:top-6 before:rounded-full before:border-4 before:border-background before:bg-primary">
                <CardHeader className="pb-3 border-b bg-muted/20">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">AI Intel Report</CardTitle>
                    <span className="text-sm font-medium text-muted-foreground bg-background px-3 py-1 rounded-full shadow-sm border">
                      {format(new Date(report.createdAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Summary</h3>
                    <p className="text-foreground leading-relaxed font-medium">{report.summary}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {report.newFeatures && report.newFeatures.length > 0 && (
                      <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Sparkles className="size-4" /> Detected Features
                        </h3>
                        <ul className="list-disc list-inside space-y-1 text-sm text-foreground/80">
                          {report.newFeatures.map((f, i) => <li key={i}>{f}</li>)}
                        </ul>
                      </div>
                    )}
                    
                    {report.businessImpact && (
                      <div className="bg-destructive/5 p-4 rounded-lg border border-destructive/10">
                        <h3 className="text-sm font-semibold text-destructive uppercase tracking-wider mb-3 flex items-center gap-2">
                          <ShieldAlert className="size-4" /> Threat Analysis
                        </h3>
                        <p className="text-sm text-foreground/80">{report.businessImpact}</p>
                      </div>
                    )}
                  </div>
                  
                  {report.recommendation && (
                    <div className="pt-4 border-t">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Strategic Recommendation</h3>
                      <p className="text-sm bg-muted p-4 rounded-md italic">{report.recommendation}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
