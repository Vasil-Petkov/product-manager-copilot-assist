import { useState } from "react";
import { Link } from "wouter";
import { useListCompetitors, useCreateCompetitor, useDeleteCompetitor, getListCompetitorsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Target, ExternalLink, Activity, Plus, Globe, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const THREAT_COLORS = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
};

export default function CompetitorsList() {
  const { data: competitors, isLoading } = useListCompetitors();
  const createCompetitor = useCreateCompetitor();
  const deleteCompetitor = useDeleteCompetitor();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    
    createCompetitor.mutate({
      data: { name, website, industry, description }
    }, {
      onSuccess: () => {
        toast({ title: "Competitor added" });
        setOpen(false);
        setName(""); setWebsite(""); setIndustry(""); setDescription("");
        queryClient.invalidateQueries({ queryKey: getListCompetitorsQueryKey() });
      }
    });
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full space-y-6 animate-in fade-in">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Target className="size-8 text-primary" />
            Competitor Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">Track market movements, feature parity, and positioning.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 gap-2">
              <Plus className="size-4" /> Add Competitor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a Competitor</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Company Name *</label>
                <Input value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Website</label>
                <Input type="url" placeholder="https://" value={website} onChange={e => setWebsite(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Industry / Category</label>
                <Input placeholder="e.g. CRM, Analytics" value={industry} onChange={e => setIndustry(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Brief Description</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={createCompetitor.isPending || !name}>
                  {createCompetitor.isPending ? "Saving..." : "Add Competitor"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="p-6 h-48"><Skeleton className="h-full w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (!competitors || competitors.length === 0) ? (
        <div className="text-center py-20 text-muted-foreground border border-dashed rounded-lg bg-card">
          No competitors tracked yet. Add one to start tracking.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {competitors.map((comp) => (
            <Card key={comp.id} className="hover:border-primary/50 transition-colors flex flex-col">
              <CardHeader className="p-5 pb-3">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className="text-xs bg-muted/50">{comp.industry || "Uncategorized"}</Badge>
                  {comp.threatLevel && (
                    <Badge variant="outline" className={THREAT_COLORS[comp.threatLevel.toLowerCase() as keyof typeof THREAT_COLORS] || ""}>
                      {comp.threatLevel} Threat
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-xl flex items-center gap-2">
                  {comp.name}
                </CardTitle>
                {comp.website && (
                  <a href={comp.website} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 w-fit mt-1">
                    <Globe className="size-3" /> {new URL(comp.website).hostname.replace('www.', '')}
                  </a>
                )}
              </CardHeader>
              <CardContent className="p-5 pt-2 flex-1">
                <div className="space-y-4">
                  <p className="text-sm text-foreground/80 line-clamp-3">
                    {comp.description || "No description provided."}
                  </p>
                  
                  {comp.latestAnalysis && (
                    <div className="bg-ai/5 p-3 rounded-md border border-ai/10">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-ai mb-1">
                        <Activity className="size-3" /> Latest AI Intel
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{comp.latestAnalysis}</p>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="p-5 pt-0 border-t mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {comp.lastAnalyzedAt ? `Analyzed ${format(new Date(comp.lastAnalyzedAt), 'MMM d')}` : "Not analyzed yet"}
                </span>
                <div className="flex items-center gap-1">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this competitor?</AlertDialogTitle>
                        <AlertDialogDescription>
                          <strong>{comp.name}</strong> and all its intelligence data will be permanently removed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => deleteCompetitor.mutate({ id: comp.id }, {
                            onSuccess: () => {
                              toast({ title: "Competitor deleted." });
                              queryClient.invalidateQueries({ queryKey: getListCompetitorsQueryKey() });
                            }
                          })}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button variant="ghost" size="sm" asChild className="hover:text-primary">
                    <Link href={`/discovery/competitors/${comp.id}`}>
                      Deep Dive <ExternalLink className="size-3 ml-1.5" />
                    </Link>
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
