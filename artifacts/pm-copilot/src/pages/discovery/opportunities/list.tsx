import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListOpportunities, useUpdateOpportunity } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, Plus, Filter, Lightbulb, BrainCircuit, MoreVertical } from "lucide-react";
import { HelpTooltip } from "@/components/help-tooltip";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface SimilaritySummary {
  analyzedAt: string;
  matches: Array<{
    candidateProductIdeaId: number;
    candidateTitle: string;
    similarityPercentage: number;
    relationship: "duplicate" | "highly_similar" | "related" | "unique";
  }>;
}

type SimilaritySummaryByIdea = Record<string, SimilaritySummary>;

const STATUS_COLORS = {
  new: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  under_review: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  ready_for_prioritization: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  archived: "bg-slate-500/10 text-slate-600 border-slate-500/20"
};

const ACTIVE_PRODUCT_IDEA_STATUSES = "new,under_review,ready_for_prioritization";

function ColumnHeaderTooltip({ label, text }: { label: string; text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>{label}</span>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="max-w-[440px] space-y-2 normal-case font-normal leading-relaxed"
        >
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function ProductIdeasList() {
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<{ id: number; title: string } | null>(null);
  const queryClient = useQueryClient();
  const updateOpportunity = useUpdateOpportunity();
  const { toast } = useToast();

  const { data: ideas, isLoading } = useListOpportunities({
    status: status === "all" ? ACTIVE_PRODUCT_IDEA_STATUSES : status,
    search: search || undefined
  });
  const { data: similaritySummary = {} } = useQuery<SimilaritySummaryByIdea>({
    queryKey: ["product-ideas", "similarity-summary"],
    queryFn: () => customFetch<SimilaritySummaryByIdea>("/api/product-ideas/similarity/summary"),
    staleTime: 30_000,
  });

  const confirmArchive = () => {
    if (!archiveTarget) return;

    updateOpportunity.mutate(
      { id: archiveTarget.id, data: { status: "archived" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
          toast({
            title: "Product Idea archived",
            description: `"${archiveTarget.title}" is now available from the Archived tab.`,
          });
          setArchiveTarget(null);
        },
        onError: () => {
          toast({
            title: "Could not archive Product Idea",
            description: "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full space-y-6 animate-in fade-in">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Lightbulb className="size-8 text-primary" />
            Product Ideas
            <HelpTooltip
              purpose="Central workspace for managing product opportunities."
              bullets={[
                "Create product ideas",
                "Review AI-generated opportunities",
                "Edit idea details",
                "Track lifecycle and status",
              ]}
            />
          </h1>
          <p className="text-muted-foreground mt-1">Your central workspace for every product opportunity — from signal to release.</p>
        </div>
        <Button className="shrink-0 gap-2" asChild>
          <Link href="/discovery/opportunities/new">
            <Plus className="size-4" /> New Product Idea
          </Link>
        </Button>
      </header>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-2 rounded-lg border shadow-sm">
        <Tabs value={status} onValueChange={setStatus} className="w-full sm:w-auto overflow-x-auto">
          <TabsList className="bg-transparent h-10 p-1">
            <TabsTrigger value="all" className="data-[state=active]:bg-secondary">All</TabsTrigger>
            <TabsTrigger value="new" className="data-[state=active]:bg-secondary">New</TabsTrigger>
            <TabsTrigger value="under_review" className="data-[state=active]:bg-secondary">Under Review</TabsTrigger>
            <TabsTrigger value="ready_for_prioritization" className="data-[state=active]:bg-secondary">Ready</TabsTrigger>
            <TabsTrigger value="archived" className="data-[state=active]:bg-secondary">Archived</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 w-full sm:w-auto px-2 pb-2 sm:p-0">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search product ideas..."
              className="pl-9 bg-background"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" className="shrink-0">
            <Filter className="size-4" />
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b">
              <tr>
                <th className="px-6 py-4 font-medium">
                  <ColumnHeaderTooltip
                    label="Product Idea"
                    text="The product opportunity or idea captured from user feedback, meetings, research, or other sources."
                  />
                </th>
                <th className="px-6 py-4 font-medium">
                  <ColumnHeaderTooltip
                    label="Status"
                    text="Shows where the product idea currently stands in the discovery process, such as New, Under Review, Ready, or Archived."
                  />
                </th>
                <th className="px-6 py-4 font-medium">
                  <ColumnHeaderTooltip
                    label="Source"
                    text="Shows where the product idea came from, such as internal input, customer feedback, surveys, support, or meetings."
                  />
                </th>
                <th className="px-6 py-4 font-medium">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>AI Confidence</span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        align="start"
                        className="max-w-[440px] space-y-2 normal-case font-normal leading-relaxed"
                      >
                        <p>
                          Indicates how confident the AI is that its analysis, extraction, classification, or interpretation of this product idea is accurate based on the information available. A higher percentage means the AI has stronger confidence in its analysis, while a lower percentage means the result may require more human review. This score reflects the AI&apos;s confidence in the analysis — it does not indicate the likelihood that the product idea will be successful, valuable, or worth building.
                        </p>
                        <p>Not analyzed means that AI analysis has not yet been performed.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </th>
                <th className="px-6 py-4 font-medium">
                  <ColumnHeaderTooltip
                    label="Similarity"
                    text="Shows whether the AI found another product idea that is similar or potentially duplicated."
                  />
                </th>
                <th className="px-6 py-4 font-medium text-right">
                  <ColumnHeaderTooltip
                    label="Actions"
                    text="Available actions you can take for the product idea, such as opening and reviewing its details."
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-64 mb-2"/><Skeleton className="h-4 w-96"/></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-24 rounded-full" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-20" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-16" /></td>
                    <td className="px-6 py-4 text-right"><Skeleton className="h-8 w-16 inline-block" /></td>
                  </tr>
                ))
              ) : ideas?.length === 0 ? (
                <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No product ideas found. Create your first one to get started.
                  </td>
                </tr>
              ) : (
                ideas?.map((idea) => (
                  <tr key={idea.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <Link
                        href={`/discovery/opportunities/${idea.id}`}
                        className="block font-semibold text-foreground mb-1 cursor-pointer hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm transition-colors"
                      >
                        {idea.title}
                      </Link>
                      <div className="text-muted-foreground line-clamp-1 max-w-xl">{idea.description}</div>
                      <div className="flex gap-2 mt-2">
                        {idea.category && <Badge variant="secondary" className="text-[10px]">{idea.category.replace(/_/g, ' ')}</Badge>}
                        <span className="text-[10px] text-muted-foreground flex items-center">
                          Created {format(new Date(idea.createdAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={STATUS_COLORS[idea.status as keyof typeof STATUS_COLORS] || ""}>
                        {idea.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                        {idea.sourceType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {idea.confidenceScore ? (
                        <div className="flex items-center gap-1.5 text-ai font-medium">
                          <BrainCircuit className="size-4" />
                          {Math.round(idea.confidenceScore * 100)}%
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Not analyzed</span>
                      )}
                    </td>
                    <td className="px-6 py-4 min-w-[220px]">
                      {similaritySummary[String(idea.id)] ? (
                        similaritySummary[String(idea.id)].matches.length > 0 ? (
                          <div className="space-y-1.5">
                            {similaritySummary[String(idea.id)].matches.map((match) => (
                              <Link
                                key={match.candidateProductIdeaId}
                                href={`/discovery/opportunities/${match.candidateProductIdeaId}`}
                                className="block max-w-[260px] truncate text-xs text-primary hover:underline"
                                title={`${match.candidateTitle} — ${Math.round(match.similarityPercentage)}%`}
                              >
                                {match.candidateTitle} — {Math.round(match.similarityPercentage)}%
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No similar ideas</span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">Not analyzed</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Product idea actions"
                            title="Product idea actions"
                          >
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/discovery/opportunities/${idea.id}`}>
                              Open/Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setArchiveTarget({ id: idea.id, title: idea.title })}
                          >
                            Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <AlertDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open && !updateOpportunity.isPending) setArchiveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this product idea?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the product idea to Archived. You can review archived ideas from the Archived tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateOpportunity.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmArchive}
              disabled={updateOpportunity.isPending}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
