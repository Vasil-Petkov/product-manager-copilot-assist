import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useGetOpportunity,
  useAnalyzeOpportunity,
  useUpdateOpportunity,
  getGetOpportunityQueryKey,
  customFetch,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Brain, ArrowLeft, Building2, User, Clock, BarChart, ExternalLink, Archive,
  FileEdit, CheckCircle2, Lightbulb, Layers, GitMerge, Users, Zap, MessageSquare,
  Plus, Trash2, Link2, Unlink, Activity, AlertTriangle, TrendingUp, ShieldCheck, Target,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkspaceData {
  idea: {
    id: number; title: string; description: string; category: string | null;
    sourceType: string; status: string; owner: string | null; tags: string[];
    urgency: string | null; sentiment: string | null; confidenceScore: number | null;
    aiSummary: string | null; problemStatement: string | null; rootCause: string | null;
    customerProblem: string | null; suggestedSolution: string | null;
    businessValue: string | null; customerValue: string | null;
    estimatedCustomerImpact: string | null; estimatedBusinessImpact: string | null;
    dependencies: string | null; aiRecommendation: string | null;
    openQuestions: string[]; createdAt: string; updatedAt: string;
  };
  evidence: {
    customerRequestCount: number; stakeholderMentions: number; meetingMentions: number;
    competitorReferences: number; socialMentions: number;
    exampleQuotes: string[]; feedbackQuotes: string[]; sourceLinks: string[];
  };
  linkedMeetings: Array<{ id: number; title: string; meetingDate: string; analyzed: boolean; attendees: string[] }>;
  linkedCompetitors: Array<{ id: number; name: string; industry: string | null; threatLevel: string | null }>;
  relatedSignals: Array<{ id: number; content: string; sourceType: string; sourceUrl: string | null }>;
  relatedFeedback: Array<{ id: number; stakeholderName: string; department: string; description: string; urgency: string | null }>;
  commentCount: number; timelineCount: number;
  health: { score: number; grade: string; breakdown: Record<string, { label: string; value: number; max: number; score: number }> };
}

interface Comment { id: number; ideaId: number; author: string; content: string; createdAt: string }
interface TimelineEvent { id: number; ideaId: number; eventType: string; description: string; metadata: unknown; createdAt: string }
interface Meeting { id: number; title: string; meetingDate: string; analyzed: boolean }
interface Competitor { id: number; name: string; industry: string | null }
interface SimilarityCandidate {
  candidateProductIdeaId: number;
  similarityPercentage: number;
  relationship: "duplicate" | "highly_similar" | "related" | "unique";
  explanation: string;
  keySimilarities: string[];
  keyDifferences: string[];
  primaryRecommendation?: { productIdeaId: number; reason: string };
  candidate: WorkspaceData["idea"];
}
interface SimilarityResponse { candidates: SimilarityCandidate[] }
interface SimilarityComparison {
  productIdeaA: WorkspaceData["idea"];
  productIdeaB: WorkspaceData["idea"];
  assessment: Omit<SimilarityCandidate, "candidateProductIdeaId" | "candidate">;
}

// ─── Status / grade helpers ───────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  under_review: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  ready_for_prioritization: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  archived: "bg-slate-500/10 text-slate-600 border-slate-500/20",
};

const GRADE_COLORS: Record<string, string> = {
  A: "text-emerald-600 bg-emerald-50 border-emerald-200",
  B: "text-blue-600 bg-blue-50 border-blue-200",
  C: "text-amber-600 bg-amber-50 border-amber-200",
  D: "text-orange-600 bg-orange-50 border-orange-200",
  F: "text-red-600 bg-red-50 border-red-200",
};

const RELATIONSHIP_LABELS: Record<SimilarityCandidate["relationship"], string> = {
  duplicate: "Potential duplicate",
  highly_similar: "Highly similar",
  related: "Related",
  unique: "Unique",
};

const RELATIONSHIP_COLORS: Record<SimilarityCandidate["relationship"], string> = {
  duplicate: "bg-red-500/10 text-red-700 border-red-500/20",
  highly_similar: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  related: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  unique: "bg-slate-500/10 text-slate-700 border-slate-500/20",
};

const TIMELINE_ICONS: Record<string, React.ReactNode> = {
  created: <Lightbulb className="size-4 text-blue-500" />,
  ai_analyzed: <Brain className="size-4 text-purple-500" />,
  comment_added: <MessageSquare className="size-4 text-slate-500" />,
  meeting_linked: <GitMerge className="size-4 text-emerald-500" />,
  competitor_linked: <Building2 className="size-4 text-red-500" />,
  status_changed: <Activity className="size-4 text-amber-500" />,
  evidence_added: <Layers className="size-4 text-blue-400" />,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProductIdeaWorkspace() {
  const [, params] = useRoute("/discovery/opportunities/:id");
  const [, navigate] = useLocation();
  const id = parseInt(params?.id || "0", 10);
  const { toast } = useToast();
  const qc = useQueryClient();

  // UI state
  const [activeTab, setActiveTab] = useState("overview");
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<WorkspaceData["idea"]>>({});
  const [newComment, setNewComment] = useState("");
  const [newTag, setNewTag] = useState("");
  const [showLinkMeeting, setShowLinkMeeting] = useState(false);
  const [showLinkCompetitor, setShowLinkCompetitor] = useState(false);
  const [similarityResults, setSimilarityResults] = useState<SimilarityCandidate[] | null>(null);
  const [keptSeparateIds, setKeptSeparateIds] = useState<Set<number>>(new Set());
  const [comparison, setComparison] = useState<SimilarityComparison | null>(null);
  const [mergeCandidate, setMergeCandidate] = useState<SimilarityCandidate | null>(null);
  const [mergePrimaryId, setMergePrimaryId] = useState<number | null>(null);

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data: opp, isLoading } = useGetOpportunity(id, {
    query: { enabled: !!id, queryKey: getGetOpportunityQueryKey(id) }
  });

  const { data: workspace, isLoading: wsLoading } = useQuery<WorkspaceData>({
    queryKey: ["workspace", id],
    queryFn: () => customFetch(`/api/product-ideas/${id}/workspace`),
    enabled: !!id,
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery<Comment[]>({
    queryKey: ["comments", id],
    queryFn: () => customFetch(`/api/product-ideas/${id}/comments`),
    enabled: !!id && activeTab === "notes",
  });

  const { data: timeline = [], isLoading: timelineLoading } = useQuery<TimelineEvent[]>({
    queryKey: ["timeline", id],
    queryFn: () => customFetch(`/api/product-ideas/${id}/timeline`),
    enabled: !!id && activeTab === "timeline",
  });

  const { data: allMeetings = [] } = useQuery<Meeting[]>({
    queryKey: ["all-meetings"],
    queryFn: () => customFetch("/api/meetings"),
    enabled: showLinkMeeting,
  });

  const { data: allCompetitors = [] } = useQuery<Competitor[]>({
    queryKey: ["all-competitors"],
    queryFn: () => customFetch("/api/competitors"),
    enabled: showLinkCompetitor,
  });

  // ─── Mutations ───────────────────────────────────────────────────────────────

  const analyze = useAnalyzeOpportunity();
  const update = useUpdateOpportunity();

  const saveEdit = () => {
    update.mutate({ id, data: editData as never }, {
      onSuccess: () => {
        toast({ title: "Saved", description: "Product Idea updated." });
        qc.invalidateQueries({ queryKey: getGetOpportunityQueryKey(id) });
        qc.invalidateQueries({ queryKey: ["workspace", id] });
        qc.invalidateQueries({ queryKey: ["product-ideas", "similarity-summary"] });
        setEditMode(false);
        setEditData({});
      },
      onError: () => toast({ title: "Save failed", variant: "destructive" }),
    });
  };

  const handleAnalyze = () => {
    analyze.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Analysis complete", description: "AI has updated the analysis." });
        qc.invalidateQueries({ queryKey: getGetOpportunityQueryKey(id) });
        qc.invalidateQueries({ queryKey: ["workspace", id] });
        qc.invalidateQueries({ queryKey: ["timeline", id] });
        qc.invalidateQueries({ queryKey: ["product-ideas", "similarity-summary"] });
      },
      onError: () => toast({ title: "Analysis failed", variant: "destructive" }),
    });
  };

  const handleStatusChange = (status: string) => {
    update.mutate({ id, data: { status } as never }, {
      onSuccess: () => {
        toast({ title: "Status updated" });
        qc.invalidateQueries({ queryKey: getGetOpportunityQueryKey(id) });
        qc.invalidateQueries({ queryKey: ["workspace", id] });
        qc.invalidateQueries({ queryKey: ["product-ideas", "similarity-summary"] });
      },
    });
  };

  const addComment = useMutation({
    mutationFn: (content: string) =>
      customFetch(`/api/product-ideas/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content, author: "PM" }),
      }),
    onSuccess: () => {
      setNewComment("");
      qc.invalidateQueries({ queryKey: ["comments", id] });
      qc.invalidateQueries({ queryKey: ["timeline", id] });
    },
  });

  const deleteComment = useMutation({
    mutationFn: (commentId: number) =>
      customFetch(`/api/product-ideas/${id}/comments/${commentId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", id] }),
  });

  const linkMeeting = useMutation({
    mutationFn: (meetingId: number) =>
      customFetch(`/api/product-ideas/${id}/link-meeting/${meetingId}`, { method: "POST" }),
    onSuccess: () => {
      setShowLinkMeeting(false);
      qc.invalidateQueries({ queryKey: ["workspace", id] });
      qc.invalidateQueries({ queryKey: ["timeline", id] });
      toast({ title: "Meeting linked" });
    },
  });

  const unlinkMeeting = useMutation({
    mutationFn: (meetingId: number) =>
      customFetch(`/api/product-ideas/${id}/link-meeting/${meetingId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace", id] }),
  });

  const linkCompetitor = useMutation({
    mutationFn: (competitorId: number) =>
      customFetch(`/api/product-ideas/${id}/link-competitor/${competitorId}`, { method: "POST" }),
    onSuccess: () => {
      setShowLinkCompetitor(false);
      qc.invalidateQueries({ queryKey: ["workspace", id] });
      qc.invalidateQueries({ queryKey: ["timeline", id] });
      toast({ title: "Competitor linked" });
    },
  });

  const unlinkCompetitor = useMutation({
    mutationFn: (competitorId: number) =>
      customFetch(`/api/product-ideas/${id}/link-competitor/${competitorId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace", id] }),
  });

  const findSimilar = useMutation({
    mutationFn: () => customFetch<SimilarityResponse>(`/api/product-ideas/${id}/similarity`, { method: "POST" }),
    onSuccess: (data) => {
      setSimilarityResults(data.candidates);
      toast({
        title: data.candidates.length ? "Similar ideas found" : "No strong matches found",
        description: data.candidates.length
          ? `${data.candidates.length} similar Product Idea${data.candidates.length === 1 ? "" : "s"} found.`
          : "No eligible ideas met the similarity threshold.",
      });
    },
    onError: () => toast({ title: "Similarity analysis failed", description: "No Product Ideas were changed.", variant: "destructive" }),
  });

  const compareIdeas = useMutation({
    mutationFn: (candidateId: number) => customFetch<SimilarityComparison>("/api/product-ideas/similarity/compare", {
      method: "POST",
      body: JSON.stringify({ productIdeaAId: id, productIdeaBId: candidateId }),
    }),
    onSuccess: setComparison,
    onError: () => toast({ title: "Comparison failed", description: "No Product Ideas were changed.", variant: "destructive" }),
  });

  const mergeIdeas = useMutation({
    mutationFn: ({ primaryProductIdeaId, duplicateProductIdeaId }: { primaryProductIdeaId: number; duplicateProductIdeaId: number }) =>
      customFetch<{ primaryProductIdea: WorkspaceData["idea"]; message: string }>("/api/product-ideas/merge", {
        method: "POST",
        body: JSON.stringify({ primaryProductIdeaId, duplicateProductIdeaId }),
      }),
    onSuccess: (data) => {
      const currentWasArchived = data.primaryProductIdea.id !== id;
      setSimilarityResults((results) => results?.filter((candidate) => candidate.candidateProductIdeaId !== mergeCandidate?.candidateProductIdeaId) ?? null);
      setMergeCandidate(null);
      setMergePrimaryId(null);
      qc.invalidateQueries({ queryKey: ["workspace"] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["product-ideas", "similarity-summary"] });
      toast({ title: "Product Ideas merged", description: data.message });
      if (currentWasArchived) navigate(`/discovery/opportunities/${data.primaryProductIdea.id}`);
    },
    onError: () => toast({ title: "Merge failed", description: "Both Product Ideas were preserved.", variant: "destructive" }),
  });

  // ─── Loading / 404 ───────────────────────────────────────────────────────────

  if (isLoading || wsLoading) {
    return (
      <div className="p-8 max-w-[1200px] mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    );
  }

  if (!opp) return <div className="p-8 text-center text-muted-foreground">Product Idea not found.</div>;

  const health = workspace?.health;
  const idea = workspace?.idea ?? opp as unknown as WorkspaceData["idea"];
  const evidence = workspace?.evidence;
  const linkedMeetings = workspace?.linkedMeetings ?? [];
  const linkedCompetitors = workspace?.linkedCompetitors ?? [];

  const startEdit = () => {
    setEditData({
      title: idea.title, description: idea.description, category: idea.category ?? "",
      owner: idea.owner ?? "", urgency: idea.urgency ?? "",
      customerProblem: idea.customerProblem ?? "", suggestedSolution: idea.suggestedSolution ?? "",
      businessValue: idea.businessValue ?? "", customerValue: idea.customerValue ?? "",
      dependencies: idea.dependencies ?? "", aiRecommendation: idea.aiRecommendation ?? "",
    });
    setEditMode(true);
  };

  const linkedMeetingIds = new Set(linkedMeetings.map(m => m.id));
  const linkedCompetitorIds = new Set(linkedCompetitors.map(c => c.id));
  const visibleSimilarityCandidates = similarityResults?.filter(
    (candidate) => !keptSeparateIds.has(candidate.candidateProductIdeaId),
  ) ?? [];

  return (
    <div className="p-8 max-w-[1200px] mx-auto w-full space-y-6 animate-in fade-in">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild className="-ml-3 text-muted-foreground hover:text-foreground">
        <Link href="/discovery/opportunities"><ArrowLeft className="mr-2 size-4" /> Back to Product Ideas</Link>
      </Button>

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-3 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={STATUS_COLORS[opp.status] || ""}>
              {opp.status.replace(/_/g, " ")}
            </Badge>
            {opp.category && (
              <Badge variant="secondary">{opp.category.replace(/_/g, " ")}</Badge>
            )}
            {opp.urgency && (
              <Badge className={opp.urgency === "high" || opp.urgency === "critical"
                ? "bg-destructive/15 text-destructive border-destructive/20"
                : "bg-amber-500/10 text-amber-600 border-amber-500/20"
              }>
                {opp.urgency}
              </Badge>
            )}
            {health && (
              <Badge variant="outline" className={`font-mono font-bold ${GRADE_COLORS[health.grade] || ""}`}>
                Health {health.grade} · {health.score}/100
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground leading-tight">{opp.title}</h1>
          <p className="text-muted-foreground leading-relaxed">{opp.description}</p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="size-3" /> Created {format(new Date(opp.createdAt), "MMM d, yyyy")}</span>
            <span className="flex items-center gap-1"><Activity className="size-3" /> Updated {formatDistanceToNow(new Date(opp.updatedAt), { addSuffix: true })}</span>
            <span className="flex items-center gap-1"><Layers className="size-3" /> Source: <code className="font-mono">{opp.sourceType}</code></span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-2" onClick={startEdit}>
            <FileEdit className="size-4" /> Edit
          </Button>
          <Button size="sm" className="gap-2 bg-ai text-ai-foreground hover:bg-ai/90"
            onClick={handleAnalyze} disabled={analyze.isPending}>
            <Brain className="size-4" /> {analyze.isPending ? "Analyzing…" : "Run AI"}
          </Button>
          {opp.status !== "ready_for_prioritization" && (
            <Button size="sm" variant="outline" className="gap-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50"
              onClick={() => handleStatusChange("ready_for_prioritization")}>
              <CheckCircle2 className="size-4" /> Mark Ready
            </Button>
          )}
          {opp.status !== "archived" && (
            <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10"
              onClick={() => handleStatusChange("archived")}>
              <Archive className="size-4 mr-1" /> Archive
            </Button>
          )}
        </div>
      </header>

      {/* ── Similarity / Duplication ── */}
      <Card className="border-ai/20">
        <CardHeader className="flex-row items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitMerge className="size-4 text-ai" /> Similarity / Duplication
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              AI recommends potential overlaps. You decide whether ideas stay separate or merge.
            </p>
          </div>
          <Button
            size="sm"
            className="shrink-0 gap-2 bg-ai text-ai-foreground hover:bg-ai/90"
            onClick={() => findSimilar.mutate()}
            disabled={findSimilar.isPending}
          >
            <Brain className="size-4" />
            {findSimilar.isPending ? "Finding…" : "Find Similar Ideas"}
          </Button>
        </CardHeader>
        {similarityResults !== null && (
          <CardContent className="space-y-3 border-t pt-4">
            {visibleSimilarityCandidates.length === 0 ? (
              <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                No meaningful similar Product Ideas are currently surfaced. You can run the check again after adding more ideas.
              </div>
            ) : (
              <>
                <p className="text-sm font-medium">
                  {visibleSimilarityCandidates.length} similar idea{visibleSimilarityCandidates.length === 1 ? "" : "s"} found
                </p>
                {visibleSimilarityCandidates.map((candidate) => (
                  <div key={candidate.candidateProductIdeaId} className="rounded-lg border bg-muted/20 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{candidate.candidate.title}</p>
                          <Badge variant="outline" className={RELATIONSHIP_COLORS[candidate.relationship]}>
                            {RELATIONSHIP_LABELS[candidate.relationship]}
                          </Badge>
                          <Badge variant="secondary">{Math.round(candidate.similarityPercentage)}% similar</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{candidate.explanation}</p>
                        {candidate.primaryRecommendation && (
                          <p className="text-xs text-ai">
                            AI suggests keeping {candidate.primaryRecommendation.productIdeaId === id ? "this Product Idea" : candidate.candidate.title}: {candidate.primaryRecommendation.reason}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => compareIdeas.mutate(candidate.candidateProductIdeaId)} disabled={compareIdeas.isPending}>
                          Compare
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/discovery/opportunities/${candidate.candidateProductIdeaId}`}>View</Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setKeptSeparateIds((ids) => new Set([...ids, candidate.candidateProductIdeaId]));
                            toast({ title: "Kept separate", description: "Neither Product Idea was changed." });
                          }}
                        >
                          Keep Separate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-destructive/30 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setMergeCandidate(candidate);
                            setMergePrimaryId(candidate.primaryRecommendation?.productIdeaId ?? id);
                          }}
                        >
                          Merge
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto border-b rounded-none bg-transparent h-auto p-0 gap-0">
          {[
            { value: "overview", label: "Overview", icon: <Lightbulb className="size-4" /> },
            { value: "ai-analysis", label: "AI Analysis", icon: <Brain className="size-4" /> },
            { value: "evidence", label: "Evidence", icon: <Layers className="size-4" /> },
            { value: "related", label: "Related", icon: <GitMerge className="size-4" /> },
            { value: "timeline", label: `Timeline${workspace?.timelineCount ? ` (${workspace.timelineCount})` : ""}`, icon: <Activity className="size-4" /> },
            { value: "notes", label: `Notes${workspace?.commentCount ? ` (${workspace.commentCount})` : ""}`, icon: <MessageSquare className="size-4" /> },
          ].map(tab => (
            <TabsTrigger key={tab.value} value={tab.value}
              className="flex items-center gap-1.5 px-4 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary bg-transparent text-sm font-medium text-muted-foreground hover:text-foreground">
              {tab.icon} {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="pt-6">
          {editMode ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between pb-4 border-b">
                <CardTitle className="text-base">Edit Product Idea</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setEditMode(false); setEditData({}); }}>Cancel</Button>
                  <Button size="sm" onClick={saveEdit} disabled={update.isPending}>
                    {update.isPending ? "Saving…" : "Save Changes"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <Label>Title</Label>
                  <Input value={editData.title ?? ""} onChange={e => setEditData(d => ({ ...d, title: e.target.value }))} />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Description</Label>
                  <Textarea rows={3} value={editData.description ?? ""} onChange={e => setEditData(d => ({ ...d, description: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={editData.category ?? ""} onValueChange={v => setEditData(d => ({ ...d, category: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {["feature_request", "pain_point", "bug", "improvement", "market_opportunity", "integration"].map(c => (
                        <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Urgency</Label>
                  <Select value={editData.urgency ?? ""} onValueChange={v => setEditData(d => ({ ...d, urgency: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select urgency" /></SelectTrigger>
                    <SelectContent>
                      {["low", "medium", "high", "critical"].map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Owner</Label>
                  <Input placeholder="PM name or email" value={editData.owner ?? ""} onChange={e => setEditData(d => ({ ...d, owner: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={(editData as { status?: string }).status ?? opp.status} onValueChange={v => setEditData(d => ({ ...d, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["new", "under_review", "ready_for_prioritization", "archived"].map(s => (
                        <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Customer Problem</Label>
                  <Textarea rows={2} placeholder="Describe the problem customers face…" value={editData.customerProblem ?? ""} onChange={e => setEditData(d => ({ ...d, customerProblem: e.target.value }))} />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Suggested Solution</Label>
                  <Textarea rows={2} placeholder="High-level solution approach…" value={editData.suggestedSolution ?? ""} onChange={e => setEditData(d => ({ ...d, suggestedSolution: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Business Value</Label>
                  <Textarea rows={2} placeholder="Revenue, retention, or strategic impact…" value={editData.businessValue ?? ""} onChange={e => setEditData(d => ({ ...d, businessValue: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Customer Value</Label>
                  <Textarea rows={2} placeholder="Time saved, friction reduced…" value={editData.customerValue ?? ""} onChange={e => setEditData(d => ({ ...d, customerValue: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Dependencies</Label>
                  <Input placeholder="Auth, API v2, design system…" value={editData.dependencies ?? ""} onChange={e => setEditData(d => ({ ...d, dependencies: e.target.value }))} />
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Customer Problem */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <User className="size-4" /> Customer Problem
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground leading-relaxed">
                      {idea.customerProblem || <span className="text-muted-foreground italic">Not defined — click Edit to add</span>}
                    </p>
                  </CardContent>
                </Card>

                {/* Suggested Solution */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Lightbulb className="size-4" /> Suggested Solution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground leading-relaxed">
                      {idea.suggestedSolution || <span className="text-muted-foreground italic">Not defined yet</span>}
                    </p>
                  </CardContent>
                </Card>

                {/* Business & Customer Value */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <Building2 className="size-4" /> Business Value
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        {idea.businessValue || <span className="text-muted-foreground italic">Not defined</span>}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <Users className="size-4" /> Customer Value
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        {idea.customerValue || <span className="text-muted-foreground italic">Not defined</span>}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                {/* Health Score */}
                {health && (
                  <Card>
                    <CardHeader className="pb-3 border-b">
                      <CardTitle className="text-sm font-semibold flex items-center justify-between">
                        <span className="flex items-center gap-2"><ShieldCheck className="size-4" /> Idea Health</span>
                        <span className={`text-lg font-bold px-2 py-0.5 rounded border ${GRADE_COLORS[health.grade] || ""}`}>
                          {health.grade}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-end gap-2 mb-2">
                        <span className="text-3xl font-bold">{health.score}</span>
                        <span className="text-muted-foreground text-sm mb-1">/ 100</span>
                      </div>
                      {Object.values(health.breakdown ?? {}).map(dim => (
                        <div key={dim.label} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{dim.label}</span>
                            <span className="font-medium">{dim.score}/{dim.label === "AI Confidence" ? 15 : dim.label === "Source Diversity" ? 10 : dim.label === "Customer Demand" ? 25 : dim.label === "Stakeholder Support" ? 20 : 15}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${Math.min(100, (dim.score / 25) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Metadata */}
                <Card>
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-sm font-semibold">Metadata</CardTitle>
                  </CardHeader>
                  <CardContent className="divide-y text-sm">
                    {[
                      { label: "Owner", value: idea.owner || "Unassigned" },
                      { label: "Source", value: idea.sourceType },
                      { label: "Sentiment", value: idea.sentiment || "Not analyzed" },
                      { label: "Confidence", value: opp.confidenceScore ? `${Math.round(opp.confidenceScore * 100)}%` : "N/A" },
                      { label: "Created", value: format(new Date(opp.createdAt), "MMM d, yyyy") },
                      { label: "Updated", value: format(new Date(opp.updatedAt), "MMM d, yyyy") },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between py-2">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium text-right ml-2">{value}</span>
                      </div>
                    ))}
                    {idea.tags && idea.tags.length > 0 && (
                      <div className="pt-3 space-y-2">
                        <span className="text-muted-foreground text-xs uppercase tracking-wider">Tags</span>
                        <div className="flex flex-wrap gap-1">
                          {idea.tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Dependencies */}
                {idea.dependencies && (
                  <Card>
                    <CardHeader className="pb-3 border-b">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Link2 className="size-4" /> Dependencies
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <p className="text-sm text-foreground/80">{idea.dependencies}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── AI Analysis ── */}
        <TabsContent value="ai-analysis" className="pt-6">
          <div className="space-y-6">
            <Card className="border-ai/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5"><Brain className="size-40" /></div>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-ai">
                  <Brain className="size-5" /> AI Analysis & Synthesis
                </CardTitle>
                <Button size="sm" className="bg-ai text-ai-foreground hover:bg-ai/90 gap-2 relative z-10"
                  onClick={handleAnalyze} disabled={analyze.isPending}>
                  <Zap className="size-4" /> {analyze.isPending ? "Analyzing…" : "Regenerate"}
                </Button>
              </CardHeader>
              <CardContent className="relative z-10 space-y-6">
                {!opp.aiSummary ? (
                  <div className="py-12 text-center space-y-4">
                    <Brain className="size-12 text-muted-foreground/30 mx-auto" />
                    <p className="text-muted-foreground">No AI analysis yet.</p>
                    <Button onClick={handleAnalyze} disabled={analyze.isPending}
                      className="bg-ai text-ai-foreground hover:bg-ai/90">
                      {analyze.isPending ? "Analyzing…" : "Run AI Analysis"}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="bg-ai/5 border border-ai/10 rounded-lg p-4">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Executive Summary</h3>
                      <p className="text-foreground leading-relaxed">{opp.aiSummary}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[
                        { icon: <Target className="size-4 text-red-500" />, label: "Problem Statement", field: "problemStatement" as const },
                        { icon: <AlertTriangle className="size-4 text-amber-500" />, label: "Root Cause", field: "rootCause" as const },
                        { icon: <TrendingUp className="size-4 text-blue-500" />, label: "Customer Impact", field: "estimatedCustomerImpact" as const },
                        { icon: <Building2 className="size-4 text-emerald-500" />, label: "Business Impact", field: "estimatedBusinessImpact" as const },
                      ].map(({ icon, label, field }) => (
                        <div key={field}>
                          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                            {icon} {label}
                          </h3>
                          <p className="text-sm text-foreground/80 leading-relaxed">
                            {(idea as unknown as Record<string, string | null>)[field] || <span className="text-muted-foreground italic">Run AI analysis to populate</span>}
                          </p>
                        </div>
                      ))}
                    </div>

                    {idea.aiRecommendation && (
                      <div className="border-l-4 border-ai pl-4">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Brain className="size-4 text-ai" /> AI Recommendation
                        </h3>
                        <p className="text-sm text-foreground/80 leading-relaxed">{idea.aiRecommendation}</p>
                      </div>
                    )}

                    {idea.openQuestions && idea.openQuestions.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                          <AlertTriangle className="size-4 text-amber-500" /> Open Questions
                        </h3>
                        <ul className="space-y-2">
                          {idea.openQuestions.map((q, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                              <span className="text-amber-500 mt-0.5">?</span> {q}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Evidence ── */}
        <TabsContent value="evidence" className="pt-6">
          <div className="space-y-6">
            {/* Counters */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { icon: <User className="size-5" />, label: "Customer Requests", value: evidence?.customerRequestCount ?? 0, color: "text-blue-500" },
                { icon: <Users className="size-5" />, label: "Stakeholder Mentions", value: evidence?.stakeholderMentions ?? 0, color: "text-purple-500" },
                { icon: <GitMerge className="size-5" />, label: "Meeting Evidence", value: evidence?.meetingMentions ?? 0, color: "text-emerald-500" },
                { icon: <Building2 className="size-5" />, label: "Competitor Refs", value: evidence?.competitorReferences ?? 0, color: "text-red-500" },
                { icon: <TrendingUp className="size-5" />, label: "Social Signals", value: evidence?.socialMentions ?? 0, color: "text-amber-500" },
                { icon: <BarChart className="size-5" />, label: "AI Confidence", value: opp.confidenceScore ? `${Math.round(opp.confidenceScore * 100)}%` : "—", color: "text-ai" },
              ].map(({ icon, label, value, color }) => (
                <Card key={label} className="text-center">
                  <CardContent className="p-4">
                    <div className={`${color} flex justify-center mb-2`}>{icon}</div>
                    <div className="text-2xl font-bold">{value}</div>
                    <div className="text-xs text-muted-foreground leading-tight mt-1">{label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Customer Quotes */}
            {evidence && (evidence.exampleQuotes.length > 0 || evidence.feedbackQuotes.length > 0) && (
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="size-4" /> Customer & Stakeholder Quotes
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {[...evidence.exampleQuotes, ...evidence.feedbackQuotes].map((quote, i) => (
                    <blockquote key={i} className="border-l-2 border-primary/30 pl-4 text-sm text-muted-foreground italic">
                      "{quote}"
                    </blockquote>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Source Links */}
            {evidence && evidence.sourceLinks.length > 0 && (
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ExternalLink className="size-4" /> Source Links
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-2">
                  {evidence.sourceLinks.map((link, i) => (
                    <a key={i} href={link} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <ExternalLink className="size-3 shrink-0" />
                      <span className="truncate">{link}</span>
                    </a>
                  ))}
                </CardContent>
              </Card>
            )}

            {!evidence || (evidence.customerRequestCount === 0 && evidence.stakeholderMentions === 0) && (
              <div className="py-12 text-center text-muted-foreground border rounded-xl border-dashed">
                <Layers className="size-10 mx-auto mb-3 opacity-30" />
                <p>No evidence linked yet. Link meetings, signals, or add stakeholder feedback to build evidence.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Related ── */}
        <TabsContent value="related" className="pt-6 space-y-6">
          {/* Meetings */}
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <GitMerge className="size-4" /> Linked Meetings ({linkedMeetings.length})
              </CardTitle>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowLinkMeeting(v => !v)}>
                <Plus className="size-4" /> Link Meeting
              </Button>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {showLinkMeeting && (
                <div className="border rounded-lg p-3 bg-secondary/30 space-y-2 mb-4">
                  <p className="text-xs text-muted-foreground font-medium">Select a meeting to link:</p>
                  {allMeetings.filter(m => !linkedMeetingIds.has(m.id)).map(meeting => (
                    <div key={meeting.id} className="flex items-center justify-between p-2 hover:bg-background rounded">
                      <div>
                        <p className="text-sm font-medium">{meeting.title}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(meeting.meetingDate), "MMM d, yyyy")}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => linkMeeting.mutate(meeting.id)}>Link</Button>
                    </div>
                  ))}
                  {allMeetings.filter(m => !linkedMeetingIds.has(m.id)).length === 0 && (
                    <p className="text-sm text-muted-foreground italic py-2">All meetings are already linked.</p>
                  )}
                </div>
              )}
              {linkedMeetings.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No meetings linked yet.</p>
              ) : (
                linkedMeetings.map(meeting => (
                  <div key={meeting.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <GitMerge className="size-4 text-emerald-500 shrink-0" />
                      <div>
                        <Link href={`/discovery/meetings/${meeting.id}`}
                          className="text-sm font-medium hover:text-primary transition-colors">{meeting.title}</Link>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(meeting.meetingDate), "MMM d, yyyy")} · {meeting.analyzed ? "Analyzed" : "Not analyzed"}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive"
                      onClick={() => unlinkMeeting.mutate(meeting.id)}>
                      <Unlink className="size-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Competitors */}
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="size-4" /> Linked Competitors ({linkedCompetitors.length})
              </CardTitle>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowLinkCompetitor(v => !v)}>
                <Plus className="size-4" /> Link Competitor
              </Button>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {showLinkCompetitor && (
                <div className="border rounded-lg p-3 bg-secondary/30 space-y-2 mb-4">
                  <p className="text-xs text-muted-foreground font-medium">Select a competitor to link:</p>
                  {allCompetitors.filter(c => !linkedCompetitorIds.has(c.id)).map(comp => (
                    <div key={comp.id} className="flex items-center justify-between p-2 hover:bg-background rounded">
                      <div>
                        <p className="text-sm font-medium">{comp.name}</p>
                        {comp.industry && <p className="text-xs text-muted-foreground">{comp.industry}</p>}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => linkCompetitor.mutate(comp.id)}>Link</Button>
                    </div>
                  ))}
                  {allCompetitors.filter(c => !linkedCompetitorIds.has(c.id)).length === 0 && (
                    <p className="text-sm text-muted-foreground italic py-2">All competitors are already linked.</p>
                  )}
                </div>
              )}
              {linkedCompetitors.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No competitors linked yet.</p>
              ) : (
                linkedCompetitors.map(comp => (
                  <div key={comp.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <Building2 className="size-4 text-red-500 shrink-0" />
                      <div>
                        <Link href={`/discovery/competitors/${comp.id}`}
                          className="text-sm font-medium hover:text-primary transition-colors">{comp.name}</Link>
                        {comp.industry && <p className="text-xs text-muted-foreground">{comp.industry}</p>}
                        {comp.threatLevel && (
                          <Badge variant="outline" className="text-[10px] mt-1">
                            {comp.threatLevel} threat
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive"
                      onClick={() => unlinkCompetitor.mutate(comp.id)}>
                      <Unlink className="size-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Stakeholder Feedback */}
          {workspace?.relatedFeedback && workspace.relatedFeedback.length > 0 && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="size-4" /> Stakeholder Feedback ({workspace.relatedFeedback.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {workspace.relatedFeedback.map(fb => (
                  <div key={fb.id} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{fb.stakeholderName}</span>
                      <Badge variant="secondary" className="text-xs">{fb.department}</Badge>
                      {fb.urgency && <Badge variant="outline" className="text-xs">{fb.urgency}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{fb.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Timeline ── */}
        <TabsContent value="timeline" className="pt-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="size-4" /> Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {timelineLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : timeline.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Activity className="size-10 mx-auto mb-3 opacity-30" />
                  <p>No timeline events yet. Events are recorded automatically as you work.</p>
                </div>
              ) : (
                <div className="relative pl-6">
                  <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                  {timeline.map((event, i) => (
                    <div key={event.id} className={`relative mb-6 ${i < timeline.length - 1 ? "" : ""}`}>
                      <div className="absolute -left-4 size-6 rounded-full bg-background border flex items-center justify-center">
                        {TIMELINE_ICONS[event.eventType] ?? <Activity className="size-3 text-muted-foreground" />}
                      </div>
                      <div className="bg-card border rounded-lg p-3">
                        <p className="text-sm font-medium">{event.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })} · {format(new Date(event.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Notes & Comments ── */}
        <TabsContent value="notes" className="pt-6 space-y-6">
          {/* Add Comment */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="size-4" /> Add Note
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <Textarea
                placeholder="Add a note, observation, or discussion point…"
                rows={3}
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
              />
              <div className="flex justify-end">
                <Button size="sm" className="gap-2"
                  disabled={!newComment.trim() || addComment.isPending}
                  onClick={() => addComment.mutate(newComment)}>
                  <Plus className="size-4" /> {addComment.isPending ? "Adding…" : "Add Note"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Comments List */}
          <div className="space-y-3">
            {commentsLoading ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
            ) : comments.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground border rounded-xl border-dashed">
                <MessageSquare className="size-10 mx-auto mb-3 opacity-30" />
                <p>No notes yet. Be the first to add context.</p>
              </div>
            ) : (
              comments.map(comment => (
                <Card key={comment.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {comment.author.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm font-medium">{comment.author}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => deleteComment.mutate(comment.id)}>
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed pl-9">{comment.content}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={comparison !== null} onOpenChange={(open) => !open && setComparison(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Compare Product Ideas</DialogTitle>
            <DialogDescription>
              Review the underlying opportunity and AI assessment. This comparison does not modify either Product Idea.
            </DialogDescription>
          </DialogHeader>
          {comparison && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                {[comparison.productIdeaA, comparison.productIdeaB].map((productIdea) => (
                  <Card key={productIdea.id}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{productIdea.title}</CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={STATUS_COLORS[productIdea.status] || ""}>
                          {productIdea.status.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant="secondary">{productIdea.sourceType}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
                        <p>{productIdea.description}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer problem</p>
                        <p>{productIdea.customerProblem || "Not defined"}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Created {format(new Date(productIdea.createdAt), "MMM d, yyyy")}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card className="border-ai/30 bg-ai/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <Brain className="size-4 text-ai" /> AI Similarity Assessment
                    <Badge variant="outline" className={RELATIONSHIP_COLORS[comparison.assessment.relationship]}>
                      {RELATIONSHIP_LABELS[comparison.assessment.relationship]}
                    </Badge>
                    <Badge variant="secondary">{Math.round(comparison.assessment.similarityPercentage)}% similar</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <p>{comparison.assessment.explanation}</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Key similarities</p>
                      <ul className="space-y-1 text-muted-foreground">
                        {comparison.assessment.keySimilarities.map((item) => <li key={item}>• {item}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Key differences</p>
                      <ul className="space-y-1 text-muted-foreground">
                        {comparison.assessment.keyDifferences.map((item) => <li key={item}>• {item}</li>)}
                      </ul>
                    </div>
                  </div>
                  {comparison.assessment.primaryRecommendation && (
                    <p className="rounded-md border border-ai/20 bg-background/60 p-3 text-ai">
                      AI suggests keeping {comparison.assessment.primaryRecommendation.productIdeaId === comparison.productIdeaA.id
                        ? comparison.productIdeaA.title
                        : comparison.productIdeaB.title}: {comparison.assessment.primaryRecommendation.reason}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setComparison(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={mergeCandidate !== null}
        onOpenChange={(open) => {
          if (!open && !mergeIdeas.isPending) {
            setMergeCandidate(null);
            setMergePrimaryId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Product Ideas?</DialogTitle>
            <DialogDescription>
              Choose the Product Idea to keep. The other idea will be archived, never automatically deleted.
            </DialogDescription>
          </DialogHeader>
          {mergeCandidate && (
            <div className="space-y-3">
              {[
                { productIdea: idea, role: "Current Product Idea" },
                { productIdea: mergeCandidate.candidate, role: "Potential duplicate" },
              ].map(({ productIdea, role }) => (
                <button
                  type="button"
                  key={productIdea.id}
                  onClick={() => setMergePrimaryId(productIdea.id)}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    mergePrimaryId === productIdea.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{role}</p>
                  <p className="mt-1 font-semibold">{productIdea.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{productIdea.description}</p>
                  {mergePrimaryId === productIdea.id && <Badge className="mt-3">Primary / keep</Badge>}
                </button>
              ))}
              <p className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-muted-foreground">
                Confirm Merge will reassign safe related records to the selected primary and archive the other Product Idea. Core title, description, and status of the primary will not be overwritten.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMergeCandidate(null); setMergePrimaryId(null); }} disabled={mergeIdeas.isPending}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!mergeCandidate || !mergePrimaryId || mergeIdeas.isPending}
              onClick={() => {
                if (!mergeCandidate || !mergePrimaryId) return;
                mergeIdeas.mutate({
                  primaryProductIdeaId: mergePrimaryId,
                  duplicateProductIdeaId: mergePrimaryId === id ? mergeCandidate.candidateProductIdeaId : id,
                });
              }}
            >
              {mergeIdeas.isPending ? "Merging…" : "Confirm Merge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
