import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, startOfMonth, startOfQuarter, startOfYear, addMonths, addQuarters, addYears, differenceInCalendarDays, min as minDate, max as maxDate } from "date-fns";
import {
  CalendarDays, ChevronDown, ChevronRight, ClipboardEdit, Flag, Lightbulb, Loader2,
  Map, MoreHorizontal, Plus, Sparkles, Target, Trash2,
} from "lucide-react";
import {
  createRoadmapInitiative, createRoadmapItem, createRoadmapMilestone, deleteRoadmapInitiative,
  deleteRoadmapItem, deleteRoadmapMilestone, generateRoadmapProposal, getGetRoadmapQueryKey,
  getRoadmap, updateRoadmapInitiative, updateRoadmapItem, useListOpportunities,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type RoadmapStatus = "planned" | "in_progress" | "completed" | "at_risk" | "on_hold";
type ViewMode = "monthly" | "quarterly" | "annual";
type Initiative = { id: number; name: string; description: string | null; createdAt: string };
type ProductIdea = {
  id: number; title: string; description: string; category: string | null; status: string;
  urgency: string | null; confidenceScore: number | null; riceScore?: number | null;
};
type RoadmapItem = {
  id: number; initiativeId: number | null; opportunityId: number; startDate: string; endDate: string;
  status: RoadmapStatus; progress: number; notes: string | null; productIdea: ProductIdea;
};
type Milestone = { id: number; initiativeId: number | null; name: string; date: string; description: string | null };
type RoadmapData = { initiatives: Initiative[]; items: RoadmapItem[]; milestones: Milestone[] };
type ProposalItem = {
  opportunityId: number; sequence: number; startDate: string; endDate: string; status: RoadmapStatus;
  progress: number; notes: string; risks: string[]; why: string;
};
type ProposalInitiative = { name: string; description: string; reason: string; items: ProposalItem[] };
type Proposal = { initiatives: ProposalInitiative[]; generatedAt: string; source: "ai" | "no_product_ideas" };

const ROADMAP_KEY = getGetRoadmapQueryKey();
const STATUS: Array<{ value: RoadmapStatus; label: string; className: string }> = [
  { value: "planned", label: "Planned", className: "bg-slate-500/10 text-slate-700 border-slate-500/20" },
  { value: "in_progress", label: "In Progress", className: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
  { value: "completed", label: "Completed", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  { value: "at_risk", label: "At Risk", className: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  { value: "on_hold", label: "On Hold", className: "bg-rose-500/10 text-rose-700 border-rose-500/20" },
];

const EMPTY_INITIATIVE = { name: "", description: "" };
const todayString = () => new Date().toISOString().slice(0, 10);
const nextMonthString = () => addMonths(new Date(), 1).toISOString().slice(0, 10);
const EMPTY_ITEM = {
  opportunityId: "", initiativeId: "none", startDate: todayString(), endDate: nextMonthString(),
  status: "planned" as RoadmapStatus, progress: "0", notes: "",
};
const EMPTY_MILESTONE = { name: "", initiativeId: "none", date: todayString(), description: "" };

function statusMeta(status: RoadmapStatus) {
  return STATUS.find((option) => option.value === status) ?? STATUS[0];
}

function dateRange(data: RoadmapData, view: ViewMode) {
  const candidates = [
    ...data.items.flatMap((item) => [new Date(`${item.startDate}T00:00:00`), new Date(`${item.endDate}T00:00:00`)]),
    ...data.milestones.map((milestone) => new Date(`${milestone.date}T00:00:00`)),
  ];
  const anchor = candidates.length ? minDate(candidates) : new Date();
  const latest = candidates.length ? maxDate(candidates) : new Date();
  if (view === "monthly") {
    const start = startOfMonth(anchor);
    const end = maxDate([addMonths(start, 11), latest]);
    return { start, end: addMonths(startOfMonth(end), 1), columns: Array.from({ length: Math.max(12, differenceInCalendarDays(addMonths(startOfMonth(end), 1), start) / 28) }, (_, index) => addMonths(start, index)) };
  }
  if (view === "quarterly") {
    const start = startOfQuarter(anchor);
    const end = maxDate([addQuarters(start, 7), latest]);
    const count = Math.max(8, Math.ceil(differenceInCalendarDays(end, start) / 82) + 1);
    return { start, end: addQuarters(start, count), columns: Array.from({ length: count }, (_, index) => addQuarters(start, index)) };
  }
  const start = startOfYear(anchor);
  const end = maxDate([addYears(start, 3), latest]);
  const count = Math.max(4, end.getFullYear() - start.getFullYear() + 1);
  return { start, end: addYears(start, count), columns: Array.from({ length: count }, (_, index) => addYears(start, index)) };
}

function TimelineBar({ item, rangeStart, rangeEnd, onEdit }: { item: RoadmapItem; rangeStart: Date; rangeEnd: Date; onEdit: () => void }) {
  const total = Math.max(1, differenceInCalendarDays(rangeEnd, rangeStart));
  const start = new Date(`${item.startDate}T00:00:00`);
  const end = new Date(`${item.endDate}T00:00:00`);
  const left = Math.max(0, Math.min(100, (differenceInCalendarDays(start, rangeStart) / total) * 100));
  const width = Math.max(2, Math.min(100 - left, ((differenceInCalendarDays(end, start) + 1) / total) * 100));
  const colors: Record<RoadmapStatus, string> = {
    planned: "bg-slate-500", in_progress: "bg-primary", completed: "bg-emerald-500", at_risk: "bg-amber-500", on_hold: "bg-rose-500",
  };
  return (
    <button
      type="button"
      onClick={onEdit}
      title={`${item.productIdea.title}: ${item.startDate} to ${item.endDate}`}
      className={`absolute top-2 h-8 min-w-6 rounded-md ${colors[item.status]} px-2 text-left text-xs font-medium text-white shadow-sm transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary`}
      style={{ left: `${left}%`, width: `${width}%` }}
    >
      <span className="block truncate">{item.productIdea.title}</span>
      <span className="absolute inset-x-0 bottom-0 h-1 rounded-b-md bg-white/30">
        <span className="block h-full rounded-b-md bg-white/80" style={{ width: `${item.progress}%` }} />
      </span>
    </button>
  );
}

function InitiativeFormDialog({
  open, onOpenChange, initiative, onSave,
}: {
  open: boolean; onOpenChange: (value: boolean) => void; initiative: Initiative | null;
  onSave: (values: typeof EMPTY_INITIATIVE) => void;
}) {
  const [values, setValues] = useState(EMPTY_INITIATIVE);
  const handleOpen = (value: boolean) => {
    if (value) setValues(initiative ? { name: initiative.name, description: initiative.description ?? "" } : EMPTY_INITIATIVE);
    onOpenChange(value);
  };
  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initiative ? "Edit initiative" : "New initiative"}</DialogTitle>
          <DialogDescription>An initiative is a high-level container for related Product Ideas.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => { event.preventDefault(); onSave(values); }} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="initiative-name">Name</Label><Input id="initiative-name" value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} required /></div>
          <div className="space-y-2"><Label htmlFor="initiative-description">Short description</Label><Textarea id="initiative-description" value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} rows={3} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit">{initiative ? "Save initiative" : "Create initiative"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Roadmap() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState<ViewMode>("monthly");
  const [initiativeDialog, setInitiativeDialog] = useState(false);
  const [editingInitiative, setEditingInitiative] = useState<Initiative | null>(null);
  const [itemDialog, setItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<RoadmapItem | null>(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM);
  const [milestoneDialog, setMilestoneDialog] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState(EMPTY_MILESTONE);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalDecisions, setProposalDecisions] = useState<Record<number, "accepted" | "rejected" | "pending">>({});
  const [editingProposal, setEditingProposal] = useState(false);
  const [expanded, setExpanded] = useState<Partial<Record<number | "unassigned", boolean>>>({});

  const { data, isLoading, isError, refetch } = useQuery<RoadmapData>({
    queryKey: getGetRoadmapQueryKey(),
    queryFn: () => getRoadmap(),
  });
  const { data: ideas = [] } = useListOpportunities({});
  const refresh = () => queryClient.invalidateQueries({ queryKey: ROADMAP_KEY });

  const createInitiative = useMutation({
    mutationFn: (payload: typeof EMPTY_INITIATIVE) => createRoadmapInitiative({ name: payload.name, description: payload.description.trim() || null }),
    onSuccess: () => { refresh(); setInitiativeDialog(false); toast({ title: "Initiative created" }); },
    onError: () => toast({ title: "Could not create initiative", variant: "destructive" }),
  });
  const updateInitiative = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: typeof EMPTY_INITIATIVE }) => updateRoadmapInitiative(id, { name: payload.name, description: payload.description.trim() || null }),
    onSuccess: () => { refresh(); setInitiativeDialog(false); setEditingInitiative(null); toast({ title: "Initiative updated" }); },
    onError: () => toast({ title: "Could not update initiative", variant: "destructive" }),
  });
  const deleteInitiative = useMutation({
    mutationFn: (id: number) => deleteRoadmapInitiative(id),
    onSuccess: () => { refresh(); toast({ title: "Initiative deleted", description: "Its Product Ideas remain on the roadmap as unassigned items." }); },
    onError: () => toast({ title: "Could not delete initiative", variant: "destructive" }),
  });
  const saveItem = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: typeof EMPTY_ITEM }) => {
      const body = {
        opportunityId: Number(payload.opportunityId),
        initiativeId: payload.initiativeId === "none" ? null : Number(payload.initiativeId),
        startDate: payload.startDate, endDate: payload.endDate, status: payload.status,
        progress: Number(payload.progress), notes: payload.notes.trim() || null,
      };
      return id ? updateRoadmapItem(id, body) : createRoadmapItem(body);
    },
    onSuccess: () => { refresh(); setItemDialog(false); setEditingItem(null); toast({ title: "Roadmap item saved" }); },
    onError: (error: Error) => toast({ title: "Could not save roadmap item", description: error.message, variant: "destructive" }),
  });
  const deleteItem = useMutation({
    mutationFn: (id: number) => deleteRoadmapItem(id),
    onSuccess: () => { refresh(); toast({ title: "Product Idea removed from roadmap" }); },
    onError: () => toast({ title: "Could not remove Product Idea", variant: "destructive" }),
  });
  const createMilestone = useMutation({
    mutationFn: (payload: typeof EMPTY_MILESTONE) => createRoadmapMilestone({
      name: payload.name, date: payload.date, initiativeId: payload.initiativeId === "none" ? null : Number(payload.initiativeId),
      description: payload.description.trim() || null,
    }),
    onSuccess: () => { refresh(); setMilestoneDialog(false); setMilestoneForm(EMPTY_MILESTONE); toast({ title: "Milestone added" }); },
    onError: () => toast({ title: "Could not add milestone", variant: "destructive" }),
  });
  const deleteMilestone = useMutation({
    mutationFn: (id: number) => deleteRoadmapMilestone(id),
    onSuccess: () => { refresh(); toast({ title: "Milestone removed" }); },
  });
  const generateProposal = useMutation({
    mutationFn: () => generateRoadmapProposal(),
    onSuccess: (nextProposal) => {
      setProposal(nextProposal);
      setProposalDecisions(Object.fromEntries(nextProposal.initiatives.map((_, index) => [index, "pending"])));
      setEditingProposal(false);
      setProposalOpen(true);
    },
    onError: () => toast({ title: "Could not generate a proposal", variant: "destructive" }),
  });
  const applyProposal = useMutation({
    mutationFn: async () => {
      if (!proposal) return;
      const accepted = proposal.initiatives.filter((_, index) => proposalDecisions[index] === "accepted");
      if (!accepted.length) throw new Error("Accept at least one recommendation before applying it.");
      for (const initiative of accepted) {
        const created = await createRoadmapInitiative({ name: initiative.name, description: initiative.description });
        for (const item of initiative.items) {
          await createRoadmapItem({
            initiativeId: created.id, opportunityId: item.opportunityId, startDate: item.startDate, endDate: item.endDate,
            status: item.status, progress: item.progress, notes: item.notes || null,
          });
        }
      }
    },
    onSuccess: () => { refresh(); setProposalOpen(false); setProposal(null); toast({ title: "Accepted recommendations applied", description: "Only the recommendations you accepted were added to the roadmap." }); },
    onError: (error: Error) => toast({ title: "Proposal was not applied", description: error.message, variant: "destructive" }),
  });

  const roadmap = data ?? { initiatives: [], items: [], milestones: [] };
  const timeline = useMemo(() => dateRange(roadmap, view), [roadmap, view]);
  const assignedIdeaIds = new Set(roadmap.items.map((item) => item.opportunityId));
  const openNewItem = () => {
    setEditingItem(null);
    setItemForm(EMPTY_ITEM);
    setItemDialog(true);
  };
  const openEditItem = (item: RoadmapItem) => {
    setEditingItem(item);
    setItemForm({
      opportunityId: String(item.opportunityId), initiativeId: item.initiativeId ? String(item.initiativeId) : "none",
      startDate: item.startDate, endDate: item.endDate, status: item.status, progress: String(item.progress), notes: item.notes ?? "",
    });
    setItemDialog(true);
  };
  const openEditInitiative = (initiative: Initiative) => {
    setEditingInitiative(initiative);
    setInitiativeDialog(true);
  };
  const groups = [
    ...roadmap.initiatives.map((initiative) => ({ key: initiative.id as number | "unassigned", initiative, items: roadmap.items.filter((item) => item.initiativeId === initiative.id) })),
    ...(roadmap.items.some((item) => item.initiativeId === null)
      ? [{ key: "unassigned" as const, initiative: null, items: roadmap.items.filter((item) => item.initiativeId === null) }]
      : []),
  ];

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto w-full space-y-6 animate-in fade-in">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight"><Map className="size-8 text-primary" /> Roadmap</h1>
            <Badge variant="secondary">V1</Badge>
          </div>
          <p className="max-w-3xl text-muted-foreground">Turn Product Ideas into an intentional, reviewable delivery sequence. The roadmap references your existing ideas without changing them.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => generateProposal.mutate()} disabled={generateProposal.isPending}>
            {generateProposal.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-ai" />}
            {generateProposal.isPending ? "Generating…" : "Generate Roadmap Proposal"}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setMilestoneDialog(true)}><Flag className="size-4" /> Add milestone</Button>
          <Button className="gap-2" onClick={openNewItem}><Plus className="size-4" /> Add Product Idea</Button>
        </div>
      </header>

      <Card className="border-primary/15 bg-primary/[0.025]">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><Sparkles className="mt-0.5 size-5 text-ai" /><p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">AI is advisory.</span> It proposes grouping, sequence, timeframes, risks, and reasoning from your Product Ideas, RICE, and validation evidence. Nothing changes until you review and apply accepted recommendations.</p></div>
          <Button size="sm" variant="ghost" className="shrink-0" asChild><Link href="/prioritization">Review prioritization</Link></Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={view} onValueChange={(value) => setView(value as ViewMode)}>
          <TabsList><TabsTrigger value="monthly">Monthly</TabsTrigger><TabsTrigger value="quarterly">Quarterly</TabsTrigger><TabsTrigger value="annual">Annual</TabsTrigger></TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <Card><CardContent className="space-y-4 p-6"><Skeleton className="h-10 w-80" /><Skeleton className="h-[380px] w-full" /></CardContent></Card>
      ) : isError ? (
        <Card><CardContent className="flex flex-col items-center gap-3 p-12 text-center"><Map className="size-10 text-muted-foreground" /><p className="font-medium">Unable to load the roadmap</p><Button variant="outline" onClick={() => refetch()}>Retry</Button></CardContent></Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-lg">Timeline</CardTitle>
            <CardDescription>Click a Product Idea bar to edit its schedule, initiative, status, progress, or roadmap notes.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-[1120px]">
                <div className="grid grid-cols-[360px_1fr] border-b bg-muted/30">
                  <div className="border-r px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Initiative / Product Idea</div>
                  <div className="relative grid" style={{ gridTemplateColumns: `repeat(${timeline.columns.length}, minmax(120px, 1fr))` }}>
                    {timeline.columns.map((column) => (
                      <div key={column.toISOString()} className="border-r px-3 py-3 text-center text-xs font-semibold text-muted-foreground">
                        {view === "monthly" ? format(column, "MMM yyyy") : view === "quarterly" ? `Q${Math.floor(column.getMonth() / 3) + 1} ${format(column, "yyyy")}` : format(column, "yyyy")}
                      </div>
                    ))}
                  </div>
                </div>

                {roadmap.milestones.length > 0 && (
                  <div className="grid grid-cols-[360px_1fr] border-b bg-amber-500/[0.025]">
                    <div className="border-r px-5 py-3 text-sm font-medium"><span className="flex items-center gap-2"><Flag className="size-4 text-amber-600" /> Milestones</span></div>
                    <div className="relative h-14 border-l" style={{ backgroundImage: `linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px)`, backgroundSize: `${100 / timeline.columns.length}% 100%` }}>
                      {roadmap.milestones.map((milestone) => {
                        const left = Math.max(0, Math.min(98, (differenceInCalendarDays(new Date(`${milestone.date}T00:00:00`), timeline.start) / Math.max(1, differenceInCalendarDays(timeline.end, timeline.start))) * 100));
                        return <button type="button" key={milestone.id} onClick={() => { if (window.confirm(`Remove milestone "${milestone.name}"?`)) deleteMilestone.mutate(milestone.id); }} className="absolute top-2 flex max-w-[160px] items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900" style={{ left: `${left}%` }} title={`${milestone.name} — ${milestone.date}. Click to remove.`}><Flag className="size-4 fill-amber-400 text-amber-600" /><span className="truncate">{milestone.name}</span></button>;
                      })}
                    </div>
                  </div>
                )}

                {groups.length === 0 ? (
                  <div className="flex min-h-72 flex-col items-center justify-center gap-4 p-10 text-center"><Target className="size-10 text-primary/50" /><div><p className="font-semibold">Start your first roadmap</p><p className="mt-1 max-w-md text-sm text-muted-foreground">Create an initiative, then place your existing Product Ideas onto a timeline.</p></div><Button onClick={() => { setEditingInitiative(null); setInitiativeDialog(true); }}>Create initiative</Button></div>
                ) : groups.map(({ key, initiative, items }) => {
                  const isExpanded = expanded[key] ?? true;
                  const progress = items.length ? Math.round(items.reduce((total, item) => total + item.progress, 0) / items.length) : 0;
                  return (
                    <div key={key} className="border-b last:border-b-0">
                      <div className="grid grid-cols-[360px_1fr] bg-muted/[0.15]">
                        <div className="flex min-h-16 items-center gap-2 border-r px-4 py-3">
                          <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => setExpanded({ ...expanded, [key]: !isExpanded })}>{isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</button>
                          <div className="min-w-0 flex-1"><p className="truncate font-semibold">{initiative?.name ?? "Unassigned Product Ideas"}</p><p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{initiative?.description ?? "Items not yet grouped into an initiative."}</p></div>
                          {initiative && <div className="flex shrink-0 gap-1"><Button size="icon" variant="ghost" className="size-8" onClick={() => openEditInitiative(initiative)}><ClipboardEdit className="size-3.5" /></Button><Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => { if (window.confirm(`Delete "${initiative.name}"? Product Ideas will remain unassigned.`)) deleteInitiative.mutate(initiative.id); }}><Trash2 className="size-3.5" /></Button></div>}
                        </div>
                        <div className="flex items-center px-4" style={{ backgroundImage: `linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px)`, backgroundSize: `${100 / timeline.columns.length}% 100%` }}><div className="w-full max-w-40"><Progress value={progress} className="h-1.5" /><span className="mt-1 block text-[11px] text-muted-foreground">{progress}% aggregate progress</span></div></div>
                      </div>
                      {isExpanded && (items.length ? items.map((item) => (
                        <div key={item.id} className="grid grid-cols-[360px_1fr]">
                          <div className="flex min-h-14 items-center gap-3 border-r px-5 pl-11 py-2"><Lightbulb className="size-4 shrink-0 text-primary/70" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.productIdea.title}</p><div className="mt-1 flex items-center gap-2"><Badge variant="outline" className={`h-5 px-1.5 text-[10px] ${statusMeta(item.status).className}`}>{statusMeta(item.status).label}</Badge><span className="text-[11px] text-muted-foreground">{item.progress}%</span></div></div><Button size="icon" variant="ghost" className="size-7" onClick={() => openEditItem(item)}><MoreHorizontal className="size-4" /></Button></div>
                          <div className="relative min-h-14" style={{ backgroundImage: `linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px)`, backgroundSize: `${100 / timeline.columns.length}% 100%` }}><TimelineBar item={item} rangeStart={timeline.start} rangeEnd={timeline.end} onEdit={() => openEditItem(item)} /></div>
                        </div>
                      )) : <div className="grid grid-cols-[360px_1fr]"><div className="border-r px-11 py-4 text-sm text-muted-foreground">No Product Ideas assigned yet.</div><div className="px-4 py-3"><Button size="sm" variant="ghost" onClick={openNewItem}>Add Product Idea</Button></div></div>)}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <InitiativeFormDialog open={initiativeDialog} onOpenChange={(open) => { setInitiativeDialog(open); if (!open) setEditingInitiative(null); }} initiative={editingInitiative} onSave={(values) => editingInitiative ? updateInitiative.mutate({ id: editingInitiative.id, payload: values }) : createInitiative.mutate(values)} />

      <Dialog open={itemDialog} onOpenChange={(open) => { setItemDialog(open); if (!open) setEditingItem(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editingItem ? "Edit roadmap item" : "Add Product Idea to roadmap"}</DialogTitle><DialogDescription>Roadmap-specific scheduling does not alter the original Product Idea.</DialogDescription></DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); saveItem.mutate({ id: editingItem?.id, payload: itemForm }); }} className="space-y-4">
            <div className="space-y-2"><Label>Product Idea</Label><Select value={itemForm.opportunityId} onValueChange={(value) => setItemForm({ ...itemForm, opportunityId: value })} disabled={Boolean(editingItem)}><SelectTrigger><SelectValue placeholder="Select an existing Product Idea" /></SelectTrigger><SelectContent>{ideas.map((idea) => <SelectItem key={idea.id} value={String(idea.id)} disabled={assignedIdeaIds.has(idea.id) && idea.id !== editingItem?.opportunityId}>{idea.title}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Initiative</Label><Select value={itemForm.initiativeId} onValueChange={(value) => setItemForm({ ...itemForm, initiativeId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No initiative yet</SelectItem>{roadmap.initiatives.map((initiative) => <SelectItem value={String(initiative.id)} key={initiative.id}>{initiative.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="roadmap-start">Start date</Label><Input id="roadmap-start" type="date" value={itemForm.startDate} onChange={(event) => setItemForm({ ...itemForm, startDate: event.target.value })} required /></div><div className="space-y-2"><Label htmlFor="roadmap-end">End date</Label><Input id="roadmap-end" type="date" value={itemForm.endDate} onChange={(event) => setItemForm({ ...itemForm, endDate: event.target.value })} required /></div></div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Status</Label><Select value={itemForm.status} onValueChange={(value) => setItemForm({ ...itemForm, status: value as RoadmapStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="roadmap-progress">Progress (0–100%)</Label><Input id="roadmap-progress" type="number" min="0" max="100" value={itemForm.progress} onChange={(event) => setItemForm({ ...itemForm, progress: event.target.value })} required /></div></div>
            <div className="space-y-2"><Label htmlFor="roadmap-notes">Roadmap notes</Label><Textarea id="roadmap-notes" rows={3} value={itemForm.notes} onChange={(event) => setItemForm({ ...itemForm, notes: event.target.value })} placeholder="Optional delivery context, assumptions, or notes." /></div>
            <DialogFooter className="sm:justify-between"><div>{editingItem && <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (window.confirm(`Remove "${editingItem.productIdea.title}" from the roadmap?`)) { deleteItem.mutate(editingItem.id); setItemDialog(false); } }}>Remove from roadmap</Button>}</div><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setItemDialog(false)}>Cancel</Button><Button type="submit" disabled={saveItem.isPending || !itemForm.opportunityId}>{saveItem.isPending ? "Saving…" : "Save roadmap item"}</Button></div></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={milestoneDialog} onOpenChange={setMilestoneDialog}>
        <DialogContent><DialogHeader><DialogTitle>Add milestone</DialogTitle><DialogDescription>Milestones appear on the shared roadmap timeline.</DialogDescription></DialogHeader><form onSubmit={(event) => { event.preventDefault(); createMilestone.mutate(milestoneForm); }} className="space-y-4"><div className="space-y-2"><Label htmlFor="milestone-name">Name</Label><Input id="milestone-name" value={milestoneForm.name} onChange={(event) => setMilestoneForm({ ...milestoneForm, name: event.target.value })} required /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Date</Label><Input type="date" value={milestoneForm.date} onChange={(event) => setMilestoneForm({ ...milestoneForm, date: event.target.value })} required /></div><div className="space-y-2"><Label>Initiative</Label><Select value={milestoneForm.initiativeId} onValueChange={(value) => setMilestoneForm({ ...milestoneForm, initiativeId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">All roadmap</SelectItem>{roadmap.initiatives.map((initiative) => <SelectItem key={initiative.id} value={String(initiative.id)}>{initiative.name}</SelectItem>)}</SelectContent></Select></div></div><div className="space-y-2"><Label>Description</Label><Textarea value={milestoneForm.description} onChange={(event) => setMilestoneForm({ ...milestoneForm, description: event.target.value })} rows={2} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setMilestoneDialog(false)}>Cancel</Button><Button type="submit" disabled={createMilestone.isPending}>Add milestone</Button></DialogFooter></form></DialogContent>
      </Dialog>

      <Dialog open={proposalOpen} onOpenChange={setProposalOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="size-5 text-ai" /> AI Roadmap Proposal</DialogTitle><DialogDescription>{proposal?.source === "no_product_ideas" ? "Product Ideas are required before an AI Roadmap Proposal can be generated." : "Review every recommendation before deciding what belongs on your roadmap."}</DialogDescription></DialogHeader>
          {proposal?.source === "no_product_ideas" ? (
            <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center">
              <Lightbulb className="size-8 text-primary/60" />
              <p className="font-medium">Add Product Ideas first</p>
              <p className="max-w-md text-sm text-muted-foreground">Create at least one Product Idea, then try generating an AI Roadmap Proposal again.</p>
            </div>
          ) : proposal && <div className="space-y-4">{proposal.initiatives.map((initiative, index) => {
            const decision = proposalDecisions[index] ?? "pending";
            return <Card key={`${initiative.name}-${index}`} className={decision === "accepted" ? "border-emerald-500/30" : decision === "rejected" ? "opacity-60" : ""}><CardHeader className="gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 flex-1">{editingProposal ? <Input value={initiative.name} onChange={(event) => setProposal({ ...proposal, initiatives: proposal.initiatives.map((current, currentIndex) => currentIndex === index ? { ...current, name: event.target.value } : current) })} /> : <CardTitle className="text-lg">{initiative.name}</CardTitle>}<p className="mt-1 text-sm text-muted-foreground">{initiative.description}</p></div><Badge variant="outline" className={decision === "accepted" ? "border-emerald-500/30 text-emerald-700" : decision === "rejected" ? "border-rose-500/30 text-rose-700" : ""}>{decision}</Badge></CardHeader><CardContent className="space-y-4"><div className="rounded-md bg-muted/50 p-3 text-sm"><span className="font-medium">Why this grouping: </span>{initiative.reason}</div><div className="space-y-2">{initiative.items.map((item, itemIndex) => { const idea = ideas.find((candidate) => candidate.id === item.opportunityId); return <div key={item.opportunityId} className="rounded-lg border p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-medium">{item.sequence}. {idea?.title ?? `Product Idea #${item.opportunityId}`}</p><p className="mt-1 text-sm text-muted-foreground">{item.why}</p>{item.risks.length > 0 && <p className="mt-2 text-xs text-amber-700">Risks: {item.risks.join(" · ")}</p>}</div>{editingProposal ? <div className="grid grid-cols-2 gap-2"><Input type="date" value={item.startDate} onChange={(event) => setProposal({ ...proposal, initiatives: proposal.initiatives.map((current, currentIndex) => currentIndex === index ? { ...current, items: current.items.map((currentItem, currentItemIndex) => currentItemIndex === itemIndex ? { ...currentItem, startDate: event.target.value } : currentItem) } : current) })} /><Input type="date" value={item.endDate} onChange={(event) => setProposal({ ...proposal, initiatives: proposal.initiatives.map((current, currentIndex) => currentIndex === index ? { ...current, items: current.items.map((currentItem, currentItemIndex) => currentItemIndex === itemIndex ? { ...currentItem, endDate: event.target.value } : currentItem) } : current) })} /></div> : <span className="shrink-0 text-xs text-muted-foreground">{item.startDate} → {item.endDate}</span>}</div></div>; })}</div><div className="flex flex-wrap gap-2 border-t pt-3"><Button size="sm" variant={decision === "accepted" ? "default" : "outline"} onClick={() => setProposalDecisions({ ...proposalDecisions, [index]: "accepted" })}>Accept</Button><Button size="sm" variant={decision === "rejected" ? "destructive" : "outline"} onClick={() => setProposalDecisions({ ...proposalDecisions, [index]: "rejected" })}>Reject</Button><Button size="sm" variant="ghost" onClick={() => setEditingProposal(!editingProposal)}>{editingProposal ? "Done editing" : "Edit recommendation"}</Button></div></CardContent></Card>;
          })}</div>}
          <DialogFooter><Button variant="outline" onClick={() => setProposalOpen(false)}>Close review</Button><Button onClick={() => applyProposal.mutate()} disabled={applyProposal.isPending || !Object.values(proposalDecisions).includes("accepted")}>{applyProposal.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Apply accepted recommendations</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}