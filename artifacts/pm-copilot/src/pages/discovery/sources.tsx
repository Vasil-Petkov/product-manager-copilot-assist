import { useState } from "react";
import { useCreateSignal, useBulkImportSignals, useListSignals, getListSignalsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Database, MessageSquare, Twitter, Users, UploadCloud, RotateCcw, AlertCircle, Video } from "lucide-react";
import { format } from "date-fns";

export default function FeedbackSources() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: signals, isLoading } = useListSignals();
  
  const createSignal = useCreateSignal();
  const bulkImport = useBulkImportSignals();
  
  // Form states
  const [socialContent, setSocialContent] = useState("");
  const [socialPlatform, setSocialPlatform] = useState("");
  const [socialAuthor, setSocialAuthor] = useState("");
  
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaDesc, setIdeaDesc] = useState("");
  const [ideaVotes, setIdeaVotes] = useState("1");
  
  const [bulkCsv, setBulkCsv] = useState("");

  const handleSocialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socialContent) return;
    
    createSignal.mutate({
      data: {
        content: socialContent,
        sourceType: "social_media",
        sourcePlatform: socialPlatform || "unknown",
        author: socialAuthor || "anonymous"
      }
    }, {
      onSuccess: () => {
        toast({ title: "Signal imported", description: "Social media feedback successfully captured." });
        setSocialContent(""); setSocialPlatform(""); setSocialAuthor("");
        queryClient.invalidateQueries({ queryKey: getListSignalsQueryKey() });
      }
    });
  };

  const handleIdeaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ideaTitle || !ideaDesc) return;
    
    createSignal.mutate({
      data: {
        content: `${ideaTitle}\n\n${ideaDesc}`,
        sourceType: "idea_portal",
        votes: parseInt(ideaVotes, 10) || 1
      }
    }, {
      onSuccess: () => {
        toast({ title: "Idea imported", description: "Feedback portal idea captured." });
        setIdeaTitle(""); setIdeaDesc(""); setIdeaVotes("1");
        queryClient.invalidateQueries({ queryKey: getListSignalsQueryKey() });
      }
    });
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkCsv) return;
    
    // Simple naive CSV parser for demo purposes
    const lines = bulkCsv.split("\n").filter(l => l.trim().length > 0);
    const inputs = lines.map(line => ({
      content: line,
      sourceType: "other" as const
    }));
    
    bulkImport.mutate({
      data: {
        signals: inputs,
        sourceType: "bulk_import"
      }
    }, {
      onSuccess: (res) => {
        toast({ title: "Bulk import complete", description: `Imported ${res.imported} signals.` });
        setBulkCsv("");
        queryClient.invalidateQueries({ queryKey: getListSignalsQueryKey() });
      }
    });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8 animate-in fade-in">
      <header>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Database className="size-8 text-primary" />
          Feedback Sources
        </h1>
        <p className="text-muted-foreground mt-1">Connect and import qualitative data from across your organization.</p>
      </header>

      <Tabs defaultValue="social" className="w-full">
        <TabsList className="bg-muted p-1 mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="social" className="flex items-center gap-2 data-[state=active]:bg-card"><Twitter className="size-4"/> Social & Web</TabsTrigger>
          <TabsTrigger value="portal" className="flex items-center gap-2 data-[state=active]:bg-card"><MessageSquare className="size-4"/> Idea Portal</TabsTrigger>
          <TabsTrigger value="bulk" className="flex items-center gap-2 data-[state=active]:bg-card"><UploadCloud className="size-4"/> Bulk Import</TabsTrigger>
          <TabsTrigger value="meetings" disabled className="flex items-center gap-2 opacity-50"><Video className="size-4"/> Meetings</TabsTrigger>
          <TabsTrigger value="stakeholder" disabled className="flex items-center gap-2 opacity-50"><Users className="size-4"/> Stakeholder</TabsTrigger>
          <TabsTrigger value="retrospective" disabled className="flex items-center gap-2 opacity-50"><RotateCcw className="size-4"/> Retrospectives</TabsTrigger>
        </TabsList>
        
        <TabsContent value="social">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle>Import Web Feedback</CardTitle>
              <CardDescription>Paste individual tweets, Reddit posts, or G2 reviews.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSocialSubmit} className="space-y-4 max-w-xl">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Platform</label>
                    <Input placeholder="e.g. Twitter, Reddit, G2" value={socialPlatform} onChange={e => setSocialPlatform(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Author (optional)</label>
                    <Input placeholder="Username or handle" value={socialAuthor} onChange={e => setSocialAuthor(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Content</label>
                  <Textarea placeholder="Paste the feedback here..." className="h-32" value={socialContent} onChange={e => setSocialContent(e.target.value)} required />
                </div>
                <Button type="submit" disabled={createSignal.isPending || !socialContent}>
                  {createSignal.isPending ? "Importing..." : "Process Signal"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="portal">
          <Card>
            <CardHeader>
              <CardTitle>Log Feature Request</CardTitle>
              <CardDescription>Manually log a request from your external feedback portal.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleIdeaSubmit} className="space-y-4 max-w-xl">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Idea Title</label>
                  <Input placeholder="Short descriptive title" value={ideaTitle} onChange={e => setIdeaTitle(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea placeholder="Full context and use cases..." className="h-32" value={ideaDesc} onChange={e => setIdeaDesc(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Vote Count</label>
                  <Input type="number" min="1" value={ideaVotes} onChange={e => setIdeaVotes(e.target.value)} className="w-32" />
                </div>
                <Button type="submit" disabled={createSignal.isPending || !ideaTitle || !ideaDesc}>
                  Submit Idea
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Import CSV</CardTitle>
              <CardDescription>Paste raw text lines or CSV data to batch process into signals.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBulkSubmit} className="space-y-4">
                <div className="bg-amber-500/10 text-amber-600 p-3 rounded-md flex gap-2 text-sm">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <p>In this demo environment, just paste raw text lines. One signal per line. The AI will categorize them automatically.</p>
                </div>
                <Textarea placeholder="Line 1: User asked for dark mode...&#10;Line 2: System crashes on export..." className="h-64 font-mono text-sm bg-muted/30" value={bulkCsv} onChange={e => setBulkCsv(e.target.value)} required />
                <Button type="submit" disabled={bulkImport.isPending || !bulkCsv}>
                  {bulkImport.isPending ? "Processing..." : "Run Bulk Import"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="space-y-4 pt-8 border-t">
        <h2 className="text-xl font-semibold tracking-tight">Recent Signals (Raw)</h2>
        
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />)}
          </div>
        ) : (!signals || signals.length === 0) ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">No raw signals in the system.</div>
        ) : (
          <div className="divide-y divide-border border rounded-lg overflow-hidden bg-card">
            {signals.map(sig => (
              <div key={sig.id} className="p-4 hover:bg-muted/30 flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-foreground line-clamp-2">{sig.content}</p>
                  <div className="flex gap-2 items-center text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{sig.sourceType}</Badge>
                    {sig.sourcePlatform && <span>via {sig.sourcePlatform}</span>}
                    <span>•</span>
                    <span>{format(new Date(sig.createdAt), 'MMM d, h:mm a')}</span>
                  </div>
                </div>
                <Badge variant={sig.processed ? "secondary" : "default"} className="shrink-0 text-[10px]">
                  {sig.processed ? "Processed" : "Pending"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
