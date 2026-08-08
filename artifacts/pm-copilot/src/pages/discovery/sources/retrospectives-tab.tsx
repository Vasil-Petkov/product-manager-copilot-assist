import { useState } from "react";
import {
  useListSignals,
  useCreateSignal,
  useDeleteSignal,
  getListSignalsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RotateCcw, Plus, Trash2, Search, Info } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// Retrospectives use the signals backend with sourceType='retrospective'.
// The signals schema stores free-form content; structured fields (action items,
// owners, due dates, completion status) require a dedicated backend table
// which does not exist yet — that is documented in the UI notice below.

const RETRO_CATEGORIES = [
  { value: "went_well", label: "✅ Went Well" },
  { value: "to_improve", label: "🔧 To Improve" },
  { value: "action_item", label: "☑️ Action Item" },
  { value: "blocker", label: "🚫 Blocker" },
  { value: "kudos", label: "🎉 Kudos" },
] as const;

type RetroCategory = (typeof RETRO_CATEGORIES)[number]["value"];

const CATEGORY_BADGE: Record<RetroCategory, { label: string; cls: string }> = {
  went_well: { label: "Went Well", cls: "bg-green-500/10 text-green-600 border-green-200" },
  to_improve: { label: "To Improve", cls: "bg-orange-500/10 text-orange-600 border-orange-200" },
  action_item: { label: "Action Item", cls: "bg-primary/10 text-primary border-primary/20" },
  blocker: { label: "Blocker", cls: "bg-destructive/10 text-destructive border-destructive/20" },
  kudos: { label: "Kudos", cls: "bg-yellow-500/10 text-yellow-600 border-yellow-200" },
};

// Convention: content is stored as "CATEGORY||sprint-name||free text"
// so we can parse category and sprint label out of the signal content.
const SEPARATOR = "||";

function encodeContent(category: string, sprint: string, text: string) {
  return [category, sprint, text].join(SEPARATOR);
}

function decodeContent(raw: string) {
  const parts = raw.split(SEPARATOR);
  if (parts.length >= 3) {
    return {
      category: parts[0] as RetroCategory,
      sprint: parts[1],
      text: parts.slice(2).join(SEPARATOR),
    };
  }
  return { category: "to_improve" as RetroCategory, sprint: "", text: raw };
}

export default function RetrospectivesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all signals — filter client-side to retrospective type
  const { data: allSignals, isLoading } = useListSignals();
  const createSignal = useCreateSignal();
  const deleteSignal = useDeleteSignal();

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Form state
  const [category, setCategory] = useState<RetroCategory>("to_improve");
  const [sprint, setSprint] = useState("");
  const [text, setText] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListSignalsQueryKey() });

  const retroSignals = (allSignals ?? []).filter(
    (s) => s.sourceType === "retrospective"
  );

  const filtered = retroSignals.filter((s) => {
    const { category: cat, sprint: sp, text: tx } = decodeContent(s.content);
    const matchesSearch =
      search.trim() === "" ||
      tx.toLowerCase().includes(search.toLowerCase()) ||
      sp.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === "all" || cat === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    createSignal.mutate(
      {
        data: {
          content: encodeContent(category, sprint, text),
          sourceType: "retrospective",
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Retrospective item added" });
          setCreateOpen(false);
          setText("");
          setSprint("");
          setCategory("to_improve");
          invalidate();
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteSignal.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Item deleted" });
          invalidate();
        },
      }
    );
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="size-5 text-primary" /> Sprint Retrospectives
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Log retrospective items by category — what went well, blockers, and action items.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="shrink-0 gap-2">
              <Plus className="size-4" /> Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Retrospective Item</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category *</label>
                  <Select
                    value={category}
                    onValueChange={(v) => setCategory(v as RetroCategory)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RETRO_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sprint / Cycle</label>
                  <Input
                    placeholder="e.g. Sprint 3"
                    value={sprint}
                    onChange={(e) => setSprint(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description *</label>
                <Textarea
                  placeholder="Describe what happened, what to improve, or what the action is..."
                  className="h-32"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  required
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button type="submit" disabled={createSignal.isPending || !text.trim()}>
                  {createSignal.isPending ? "Saving..." : "Add Item"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Backend limitation notice */}
        <div className="flex gap-3 p-3 rounded-lg border border-muted bg-muted/30 text-sm text-muted-foreground">
          <Info className="size-4 shrink-0 mt-0.5 text-primary" />
          <p>
            Retrospective items are stored using the signals backend (
            <code className="text-xs font-mono">sourceType: retrospective</code>). Full
            action-item tracking with owners, due dates, and completion status requires a
            dedicated backend table — planned for a future sprint.
          </p>
        </div>

        {/* Search + Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search items or sprint..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {RETRO_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Group by category for better readability */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-muted/10">
            {retroSignals.length === 0
              ? 'No retrospective items yet. Click \u201cAdd Item\u201d to log your first entry.'
              : "No items match your search."}
          </div>
        ) : (
          <div className="divide-y divide-border border rounded-lg overflow-hidden bg-card">
            {filtered.map((signal) => {
              const { category: cat, sprint: sp, text: tx } = decodeContent(signal.content);
              const badge = CATEGORY_BADGE[cat] ?? CATEGORY_BADGE.to_improve;
              return (
                <div
                  key={signal.id}
                  className="p-4 hover:bg-muted/20 transition-colors flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${badge.cls}`}>
                        {badge.label}
                      </Badge>
                      {sp && (
                        <Badge variant="outline" className="text-[10px]">
                          {sp}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground/80">{tx}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(signal.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete item?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this retrospective entry.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleDelete(signal.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {filtered.length > 0 && (
        <CardFooter className="text-xs text-muted-foreground border-t pt-4">
          {filtered.length} item{filtered.length !== 1 ? "s" : ""} shown
          {categoryFilter !== "all" || search
            ? ` (filtered from ${retroSignals.length} total)`
            : ""}
        </CardFooter>
      )}
    </Card>
  );
}
