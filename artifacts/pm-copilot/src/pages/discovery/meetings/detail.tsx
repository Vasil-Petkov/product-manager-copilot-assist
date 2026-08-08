import { useRoute, Link, useLocation } from "wouter";
import { useGetMeeting, useAnalyzeMeeting, getGetMeetingQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Video, Calendar, Users, Brain, Lightbulb, AlertTriangle, Target, Briefcase, HelpCircle, CheckSquare } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function MeetingDetail() {
  const [, params] = useRoute("/discovery/meetings/:id");
  const id = parseInt(params?.id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: meeting, isLoading } = useGetMeeting(id, {
    query: { enabled: !!id, queryKey: getGetMeetingQueryKey(id) }
  });

  const analyze = useAnalyzeMeeting();

  const handleAnalyze = () => {
    analyze.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Analysis complete", description: "Insights extracted from transcript." });
        queryClient.invalidateQueries({ queryKey: getGetMeetingQueryKey(id) });
      }
    });
  };

  if (isLoading) return <div className="p-8 space-y-6"><Skeleton className="h-20 w-full max-w-xl"/><Skeleton className="h-[500px] w-full"/></div>;
  if (!meeting) return <div className="p-8 text-center text-muted-foreground">Meeting not found.</div>;

  const insights = meeting.extractedInsights;

  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full space-y-6 animate-in fade-in">
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-3 text-muted-foreground hover:text-foreground">
        <Link href="/discovery/meetings"><ArrowLeft className="mr-2 size-4" /> Back to Meetings</Link>
      </Button>

      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 bg-card p-6 rounded-xl border shadow-sm">
        <div className="space-y-4 flex-1">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Video className="size-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                {meeting.title}
              </h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1"><Calendar className="size-3.5"/> {format(new Date(meeting.meetingDate), 'MMM d, yyyy')}</span>
                {meeting.attendees && meeting.attendees.length > 0 && (
                  <span className="flex items-center gap-1"><Users className="size-3.5"/> {meeting.attendees.join(', ')}</span>
                )}
              </div>
            </div>
          </div>
          {meeting.notes && <p className="text-foreground/80">{meeting.notes}</p>}
        </div>
        
        <div className="flex flex-col items-end gap-3 shrink-0">
          {!meeting.analyzed ? (
            <Button onClick={handleAnalyze} disabled={analyze.isPending || !meeting.transcript} className="bg-ai text-ai-foreground hover:bg-ai/90 shadow-sm gap-2">
              <Brain className="size-4" /> {analyze.isPending ? "Analyzing Transcript..." : "Run AI Extraction"}
            </Button>
          ) : (
            <Badge className="bg-ai/10 text-ai border-ai/20 hover:bg-ai/10 gap-1.5 py-1.5">
              <Brain className="size-3.5" /> AI Analyzed
            </Badge>
          )}
          {!meeting.transcript && (
            <p className="text-xs text-destructive">No transcript available to analyze.</p>
          )}
        </div>
      </header>

      {meeting.analyzed && insights ? (
        <div className="space-y-8 mt-8">
          {insights.summary && (
            <Card className="bg-ai/5 border-ai/20 shadow-none">
              <CardContent className="p-6">
                <h3 className="text-sm font-semibold text-ai uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Brain className="size-4" /> AI Summary
                </h3>
                <p className="text-foreground leading-relaxed">{insights.summary}</p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <InsightPanel title="Pain Points" icon={AlertTriangle} items={insights.painPoints} color="text-destructive" bg="bg-destructive/5" border="border-destructive/10" />
            <InsightPanel title="Feature Requests" icon={Lightbulb} items={insights.featureRequests} color="text-primary" bg="bg-primary/5" border="border-primary/10" />
            <InsightPanel title="Business Opportunities" icon={Briefcase} items={insights.businessOpportunities} color="text-success" bg="bg-success/5" border="border-success/10" />
            <InsightPanel title="Competitor Mentions" icon={Target} items={insights.competitorMentions} color="text-warning" bg="bg-warning/5" border="border-warning/10" />
            <InsightPanel title="Action Items" icon={CheckSquare} items={insights.actionItems} color="text-foreground" bg="bg-muted/30" border="border-border" />
            <InsightPanel title="Open Questions" icon={HelpCircle} items={insights.openQuestions} color="text-foreground" bg="bg-muted/30" border="border-border" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Raw Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              {meeting.transcript ? (
                <div className="bg-muted/30 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap h-96 overflow-y-auto">
                  {meeting.transcript}
                </div>
              ) : (
                <p className="text-muted-foreground italic text-center py-12">No transcript provided.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function InsightPanel({ title, icon: Icon, items, color, bg, border }: any) {
  if (!items || items.length === 0) return null;
  
  return (
    <Card className={`${bg} ${border} shadow-sm`}>
      <CardHeader className="pb-3">
        <CardTitle className={`text-base flex items-center gap-2 ${color}`}>
          <Icon className="size-5" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {items.map((item: string, i: number) => (
            <li key={i} className="text-sm text-foreground/90 flex items-start gap-2">
              <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${color.replace('text-', 'bg-')}`} />
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
