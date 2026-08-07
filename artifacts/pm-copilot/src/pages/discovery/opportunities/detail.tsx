import { useRoute, Link, useLocation } from "wouter";
import { useGetOpportunity, useAnalyzeOpportunity, useUpdateOpportunity, getGetOpportunityQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, ArrowLeft, Building2, User, Play, Clock, BarChart, ExternalLink, Archive, FileEdit } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
const OpportunityPatchStatus = { new: 'new', under_review: 'under_review', ready_for_prioritization: 'ready_for_prioritization', archived: 'archived' } as const;
type OpportunityPatchStatus = typeof OpportunityPatchStatus[keyof typeof OpportunityPatchStatus];

export default function OpportunityDetail() {
  const [, params] = useRoute("/discovery/opportunities/:id");
  const id = parseInt(params?.id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: opp, isLoading } = useGetOpportunity(id, {
    query: { enabled: !!id, queryKey: getGetOpportunityQueryKey(id) }
  });

  const analyze = useAnalyzeOpportunity();
  const update = useUpdateOpportunity();

  const handleAnalyze = () => {
    analyze.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Analysis complete", description: "AI has updated the opportunity insights." });
        queryClient.invalidateQueries({ queryKey: getGetOpportunityQueryKey(id) });
      },
      onError: () => {
        toast({ title: "Analysis failed", description: "Something went wrong.", variant: "destructive" });
      }
    });
  };

  const handleStatusChange = (status: OpportunityPatchStatus) => {
    update.mutate({ id, data: { status } }, {
      onSuccess: (data) => {
        toast({ title: "Status updated", description: `Opportunity marked as ${status.replace(/_/g, ' ')}` });
        queryClient.setQueryData(getGetOpportunityQueryKey(id), (old: any) => 
          old ? { ...old, status: data.status } : old
        );
      }
    });
  };

  if (isLoading) {
    return <div className="p-8 space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-[400px] w-full" /></div>;
  }

  if (!opp) return <div className="p-8 text-center text-muted-foreground">Opportunity not found.</div>;

  return (
    <div className="p-8 max-w-[1200px] mx-auto w-full space-y-6 animate-in fade-in">
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-3 text-muted-foreground hover:text-foreground">
        <Link href="/discovery/opportunities"><ArrowLeft className="mr-2 size-4" /> Back to Opportunities</Link>
      </Button>
      
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="space-y-4 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="uppercase tracking-wider">{opp.status.replace(/_/g, ' ')}</Badge>
            <Badge variant="secondary">{opp.category || "Uncategorized"}</Badge>
            {opp.urgency && <Badge className="bg-destructive text-destructive-foreground">{opp.urgency}</Badge>}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{opp.title}</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">{opp.description}</p>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="outline" size="sm" className="gap-2">
            <FileEdit className="size-4" /> Edit
          </Button>
          {opp.status !== 'ready_for_prioritization' && (
            <Button size="sm" className="gap-2" onClick={() => handleStatusChange('ready_for_prioritization')}>
              Mark Ready
            </Button>
          )}
          {opp.status !== 'archived' && (
            <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => handleStatusChange('archived')}>
              <Archive className="size-4 mr-2" /> Archive
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-ai/30 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Brain className="size-32" />
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-ai">
                <Brain className="size-5" /> AI Analysis & Synthesis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 relative z-10">
              {opp.aiSummary ? (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Executive Summary</h3>
                    <p className="text-foreground leading-relaxed bg-ai/5 p-4 rounded-lg border border-ai/10">{opp.aiSummary}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2"><User className="size-4"/> Customer Problem</h3>
                      <p className="text-sm text-foreground/80 leading-relaxed">{opp.customerProblem || "Not defined yet."}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2"><Building2 className="size-4"/> Business Value</h3>
                      <p className="text-sm text-foreground/80 leading-relaxed">{opp.businessValue || "Not defined yet."}</p>
                    </div>
                  </div>
                  
                  {opp.suggestedSolution && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2"><Play className="size-4"/> Suggested Solution</h3>
                      <p className="text-sm text-foreground/80 leading-relaxed">{opp.suggestedSolution}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-8 text-center space-y-4">
                  <p className="text-muted-foreground">This opportunity hasn't been analyzed yet.</p>
                  <Button onClick={handleAnalyze} disabled={analyze.isPending} className="bg-ai text-ai-foreground hover:bg-ai/90">
                    {analyze.isPending ? "Analyzing..." : "Run AI Analysis"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer Quotes & Evidence</CardTitle>
            </CardHeader>
            <CardContent>
              {opp.evidence?.exampleQuotes && opp.evidence.exampleQuotes.length > 0 ? (
                <div className="space-y-4">
                  {opp.evidence.exampleQuotes.map((quote, i) => (
                    <blockquote key={i} className="border-l-2 border-primary pl-4 text-sm text-muted-foreground italic">
                      "{quote}"
                    </blockquote>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No direct quotes attached.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold">Evidence Metrics</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y text-sm">
                <div className="flex justify-between items-center p-4">
                  <span className="text-muted-foreground flex items-center gap-2"><User className="size-4"/> Request Count</span>
                  <span className="font-semibold">{opp.evidence?.customerRequestCount || 0}</span>
                </div>
                <div className="flex justify-between items-center p-4">
                  <span className="text-muted-foreground flex items-center gap-2"><Building2 className="size-4"/> Stakeholder Refs</span>
                  <span className="font-semibold">{opp.evidence?.stakeholderMentions || 0}</span>
                </div>
                <div className="flex justify-between items-center p-4">
                  <span className="text-muted-foreground flex items-center gap-2"><ExternalLink className="size-4"/> Competitor Refs</span>
                  <span className="font-semibold">{opp.evidence?.competitorReferences || 0}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-muted/20">
                  <span className="text-muted-foreground flex items-center gap-2"><BarChart className="size-4"/> Confidence Score</span>
                  <span className="font-semibold text-ai">
                    {opp.confidenceScore ? `${Math.round(opp.confidenceScore * 100)}%` : 'N/A'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(opp.createdAt), 'MMM d, yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span>{format(new Date(opp.updatedAt), 'MMM d, yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Primary Source</span>
                <span className="font-mono text-xs">{opp.sourceType}</span>
              </div>
              
              {opp.tags && opp.tags.length > 0 && (
                <div className="pt-4 border-t space-y-2">
                  <span className="text-muted-foreground block">Tags</span>
                  <div className="flex flex-wrap gap-1">
                    {opp.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs bg-secondary/50">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
