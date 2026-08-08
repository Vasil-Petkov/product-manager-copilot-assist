import { useState } from "react";
import {
  useListFeedback,
  useCreateFeedback,
  useUpdateFeedback,
  useDeleteFeedback,
  useListOpportunities,
  getListFeedbackQueryKey,
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
import { Users, Plus, Pencil, Trash2, Search, Link2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const DEPARTMENTS = [
  { value: "sales", label: "Sales" },
  { value: "customer_success", label: "Customer Success" },
  { value: "support", label: "Support" },
  { value: "marketing", label: "Marketing" },
  { value: "executives", label: "Executives" },
  { value: "engineering", label: "Engineering" },
  { value: "other", label: "Other" },
] as const;

type Department = (typeof DEPARTMENTS)[number]["value"];

const DEPT_COLORS: Record<Department, string> = {
  sales: "bg-blue-500/10 text-blue-600 border-blue-200",
  customer_success: "bg-green-500/10 text-green-600 border-green-200",
  support: "bg-orange-500/10 text-orange-600 border-orange-200",
  marketing: "bg-purple-500/10 text-purple-600 border-purple-200",
  executives: "bg-red-500/10 text-red-600 border-red-200",
  engineering: "bg-cyan-500/10 text-cyan-600 border-cyan-200",
  other: "bg-muted text-muted-foreground border-border",
};

const DEPT_LABEL: Record<Department, string> = {
  sales: "Sales",
  customer_success: "Customer Success",
  support: "Support",
  marketing: "Marketing",
  executives: "Executives",
  engineering: "Engineering",
  other: "Other",
};

interface FeedbackFormValues {
  stakeholderName: string;
  department: Department;
  description: string;
  customerImpact: string;
  businessContext: string;
  urgency: string;
  opportunityId: string;
}

function FeedbackForm({
  initialValues,
  onSubmit,
  isPending,
  submitLabel,
  opportunities,
}: {
  initialValues?: Partial<FeedbackFormValues>;
  onSubmit: (v: FeedbackFormValues) => void;
  isPending: boolean;
  submitLabel: string;
  opportunities: Array<{ id: number; title: string }>;
}) {
  const [stakeholderName, setStakeholderName] = useState(initialValues?.stakeholderName ?? "");
  const [department, setDepartment] = useState<Department>(
    (initialValues?.department as Department) ?? "sales"
  );
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [customerImpact, setCustomerImpact] = useState(initialValues?.customerImpact ?? "");
  const [businessContext, setBusinessContext] = useState(initialValues?.businessContext ?? "");
  const [urgency, setUrgency] = useState(initialValues?.urgency ?? "");
  const [opportunityId, setOpportunityId] = useState(initialValues?.opportunityId ?? "none");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stakeholderName || !description) return;
    onSubmit({
      stakeholderName,
      department,
      description,
      customerImpact,
      businessContext,
      urgency,
      opportunityId,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Stakeholder Name *</label>
          <Input
            placeholder="e.g. Sarah Johnson"
            value={stakeholderName}
            onChange={(e) => setStakeholderName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Department *</label>
          <Select value={department} onValueChange={(v) => setDepartment(v as Department)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Description *</label>
        <Textarea
          placeholder="What did this stakeholder request or report?"
          className="h-28"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Customer Impact</label>
          <Input
            placeholder="e.g. Affects 30% of enterprise accounts"
            value={customerImpact}
            onChange={(e) => setCustomerImpact(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Urgency</label>
          <Input
            placeholder="e.g. Blocking renewal Q3"
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Business Context</label>
        <Textarea
          placeholder="Any additional business context..."
          className="h-20"
          value={businessContext}
          onChange={(e) => setBusinessContext(e.target.value)}
        />
      </div>

      {opportunities.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Link2 className="size-4 text-primary" /> Link to Product Idea
          </label>
          <Select value={opportunityId} onValueChange={setOpportunityId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a product idea (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No link</SelectItem>
              {opportunities.map((o) => (
                <SelectItem key={o.id} value={String(o.id)}>
                  {o.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="pt-2 flex justify-end">
        <Button type="submit" disabled={isPending || !stakeholderName || !description}>
          {isPending ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export default function StakeholdersTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: feedbackList, isLoading } = useListFeedback();
  const { data: opportunities } = useListOpportunities();
  const createFeedback = useCreateFeedback();
  const updateFeedback = useUpdateFeedback();
  const deleteFeedback = useDeleteFeedback();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListFeedbackQueryKey() });

  const buildPayload = (v: FeedbackFormValues) => ({
    department: v.department,
    stakeholderName: v.stakeholderName,
    description: v.description,
    customerImpact: v.customerImpact || undefined,
    businessContext: v.businessContext || undefined,
    urgency: v.urgency || undefined,
  });

  const handleCreate = (v: FeedbackFormValues) => {
    createFeedback.mutate(
      { data: buildPayload(v) },
      {
        onSuccess: () => {
          toast({ title: "Stakeholder feedback saved" });
          setCreateOpen(false);
          invalidate();
        },
      }
    );
  };

  const currentItem = feedbackList?.find((f) => f.id === editTarget);

  const handleEdit = (v: FeedbackFormValues) => {
    if (!editTarget) return;
    updateFeedback.mutate(
      { id: editTarget, data: buildPayload(v) },
      {
        onSuccess: () => {
          toast({ title: "Feedback updated" });
          setEditTarget(null);
          invalidate();
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteFeedback.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Feedback deleted" });
          invalidate();
        },
      }
    );
  };

  const opps = opportunities ?? [];

  const filtered = (feedbackList ?? []).filter((f) => {
    const matchesSearch =
      search.trim() === "" ||
      f.stakeholderName.toLowerCase().includes(search.toLowerCase()) ||
      f.description.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === "all" || f.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-primary" /> Stakeholder Feedback
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Capture requests and concerns from internal stakeholders across departments.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="shrink-0 gap-2">
              <Plus className="size-4" /> Add Feedback
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Log Stakeholder Feedback</DialogTitle>
            </DialogHeader>
            <FeedbackForm
              onSubmit={handleCreate}
              isPending={createFeedback.isPending}
              submitLabel="Save Feedback"
              opportunities={opps.map((o) => ({ id: o.id, title: o.title }))}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search + Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or description..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {DEPARTMENTS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-muted/10">
            {feedbackList?.length === 0
              ? 'No stakeholder feedback yet. Click \u201cAdd Feedback\u201d to get started.'
              : 'No entries match your search.'}
          </div>
        ) : (
          <div className="divide-y divide-border border rounded-lg overflow-hidden bg-card">
            {filtered.map((item) => {
              const dept = item.department as Department;
              const linkedIdea = opps.find((o) => o.id === item.opportunityId);
              return (
                <div
                  key={item.id}
                  className="p-4 hover:bg-muted/20 transition-colors flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{item.stakeholderName}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${DEPT_COLORS[dept] ?? ""}`}
                      >
                        {DEPT_LABEL[dept] ?? dept}
                      </Badge>
                      {item.urgency && (
                        <Badge variant="outline" className="text-[10px] border-warning/30 text-warning bg-warning/5">
                          {item.urgency}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground/80 line-clamp-2">{item.description}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {item.customerImpact && (
                        <span className="italic">Impact: {item.customerImpact}</span>
                      )}
                      {linkedIdea && (
                        <span className="flex items-center gap-1 text-primary">
                          <Link2 className="size-3" /> {linkedIdea.title}
                        </span>
                      )}
                      <span>{format(new Date(item.createdAt), "MMM d, yyyy")}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Edit */}
                    <Dialog
                      open={editTarget === item.id}
                      onOpenChange={(open) => setEditTarget(open ? item.id : null)}
                    >
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <Pencil className="size-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Edit Stakeholder Feedback</DialogTitle>
                        </DialogHeader>
                        {currentItem && (
                          <FeedbackForm
                            initialValues={{
                              stakeholderName: currentItem.stakeholderName,
                              department: currentItem.department as Department,
                              description: currentItem.description,
                              customerImpact: currentItem.customerImpact ?? "",
                              businessContext: currentItem.businessContext ?? "",
                              urgency: currentItem.urgency ?? "",
                              opportunityId: currentItem.opportunityId
                                ? String(currentItem.opportunityId)
                                : "none",
                            }}
                            onSubmit={handleEdit}
                            isPending={updateFeedback.isPending}
                            submitLabel="Save Changes"
                            opportunities={opps.map((o) => ({ id: o.id, title: o.title }))}
                          />
                        )}
                      </DialogContent>
                    </Dialog>

                    {/* Delete */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete feedback?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the feedback from{" "}
                            <strong>{item.stakeholderName}</strong>.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDelete(item.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {filtered.length > 0 && (
        <CardFooter className="text-xs text-muted-foreground border-t pt-4">
          {filtered.length} entr{filtered.length !== 1 ? "ies" : "y"} shown
          {deptFilter !== "all" || search
            ? ` (filtered from ${feedbackList?.length ?? 0} total)`
            : ""}
        </CardFooter>
      )}
    </Card>
  );
}
