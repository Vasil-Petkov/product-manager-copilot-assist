import { useState } from "react";
import { Link } from "wouter";
import {
  useListMeetings,
  useCreateMeeting,
  useUpdateMeeting,
  useDeleteMeeting,
  getListMeetingsQueryKey,
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
import {
  Video,
  Calendar,
  Users,
  Plus,
  BrainCircuit,
  ExternalLink,
  Search,
  Pencil,
  Trash2,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const FILTER_OPTIONS = [
  { value: "all", label: "All Meetings" },
  { value: "analyzed", label: "AI Analyzed" },
  { value: "pending", label: "Pending Analysis" },
];

function MeetingForm({
  initialValues,
  onSubmit,
  isPending,
  submitLabel,
}: {
  initialValues?: {
    title: string;
    date: string;
    attendees: string;
    transcript: string;
    notes: string;
  };
  onSubmit: (values: {
    title: string;
    date: string;
    attendees: string;
    transcript: string;
    notes: string;
  }) => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [date, setDate] = useState(initialValues?.date ?? format(new Date(), "yyyy-MM-dd"));
  const [attendees, setAttendees] = useState(initialValues?.attendees ?? "");
  const [transcript, setTranscript] = useState(initialValues?.transcript ?? "");
  const [notes, setNotes] = useState(initialValues?.notes ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date) return;
    onSubmit({ title, date, attendees, transcript, notes });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Meeting Title *</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Date *</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Attendees</label>
        <Input
          placeholder="e.g. Jane Smith, Acme Corp"
          value={attendees}
          onChange={(e) => setAttendees(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <BrainCircuit className="size-4 text-ai" /> Transcript (For AI Analysis)
        </label>
        <Textarea
          placeholder="Paste Zoom / Gong / Fireflies transcript here..."
          className="h-40 font-mono text-xs bg-muted/30"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Manual Notes</label>
        <Textarea
          className="h-20"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <div className="pt-2 flex justify-end">
        <Button type="submit" disabled={isPending || !title || !date}>
          {isPending ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export default function MeetingsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: meetings, isLoading } = useListMeetings();
  const createMeeting = useCreateMeeting();
  const updateMeeting = useUpdateMeeting();
  const deleteMeeting = useDeleteMeeting();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey() });

  const handleCreate = (values: {
    title: string;
    date: string;
    attendees: string;
    transcript: string;
    notes: string;
  }) => {
    createMeeting.mutate(
      {
        data: {
          title: values.title,
          meetingDate: new Date(values.date).toISOString(),
          attendees: values.attendees
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean),
          transcript: values.transcript,
          notes: values.notes,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Meeting logged", description: "Ready for AI analysis." });
          setCreateOpen(false);
          invalidate();
        },
      }
    );
  };

  const currentMeeting = meetings?.find((m) => m.id === editTarget);

  const handleEdit = (values: {
    title: string;
    date: string;
    attendees: string;
    transcript: string;
    notes: string;
  }) => {
    if (!editTarget) return;
    updateMeeting.mutate(
      {
        id: editTarget,
        data: {
          title: values.title,
          meetingDate: new Date(values.date).toISOString(),
          attendees: values.attendees
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean),
          transcript: values.transcript,
          notes: values.notes,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Meeting updated" });
          setEditTarget(null);
          invalidate();
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteMeeting.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Meeting deleted" });
          invalidate();
        },
      }
    );
  };

  const filtered = (meetings ?? []).filter((m) => {
    const matchesSearch =
      search.trim() === "" ||
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      (m.attendees ?? []).some((a) =>
        a.toLowerCase().includes(search.toLowerCase())
      );
    const matchesFilter =
      filter === "all" ||
      (filter === "analyzed" && m.analyzed) ||
      (filter === "pending" && !m.analyzed);
    return matchesSearch && matchesFilter;
  });

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Video className="size-5 text-primary" /> Customer Meetings
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Log call transcripts — AI extracts opportunities and insights automatically.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="shrink-0 gap-2">
              <Plus className="size-4" /> Log Meeting
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Log Customer Meeting</DialogTitle>
            </DialogHeader>
            <MeetingForm
              onSubmit={handleCreate}
              isPending={createMeeting.isPending}
              submitLabel="Save Meeting"
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
              placeholder="Search by title or attendee..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48 gap-2">
              <Filter className="size-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-muted/10">
            {meetings?.length === 0
              ? 'No meetings logged yet. Click \u201cLog Meeting\u201d to get started.'
              : 'No meetings match your search.'}
          </div>
        ) : (
          <div className="divide-y divide-border border rounded-lg overflow-hidden bg-card">
            {filtered.map((meeting) => (
              <div
                key={meeting.id}
                className="p-4 hover:bg-muted/20 flex items-start justify-between gap-4 transition-colors"
              >
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm truncate">{meeting.title}</span>
                    <Badge
                      variant={meeting.analyzed ? "secondary" : "outline"}
                      className={
                        meeting.analyzed
                          ? "bg-ai/10 text-ai hover:bg-ai/20 text-[10px]"
                          : "text-[10px]"
                      }
                    >
                      {meeting.analyzed ? "Analyzed" : "Pending"}
                    </Badge>
                    {meeting.opportunitiesExtracted ? (
                      <Badge
                        variant="outline"
                        className="bg-primary/5 text-primary border-primary/20 text-[10px]"
                      >
                        {meeting.opportunitiesExtracted} opps
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {format(new Date(meeting.meetingDate), "MMM d, yyyy")}
                    </span>
                    {meeting.attendees && meeting.attendees.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="size-3" />
                        {meeting.attendees.slice(0, 3).join(", ")}
                        {meeting.attendees.length > 3 &&
                          ` +${meeting.attendees.length - 3} more`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="icon" className="size-8" asChild>
                    <Link href={`/discovery/meetings/${meeting.id}`} title="View details & AI analysis">
                      <ExternalLink className="size-4" />
                    </Link>
                  </Button>

                  {/* Edit */}
                  <Dialog
                    open={editTarget === meeting.id}
                    onOpenChange={(open) => setEditTarget(open ? meeting.id : null)}
                  >
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <Pencil className="size-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Edit Meeting</DialogTitle>
                      </DialogHeader>
                      {currentMeeting && (
                        <MeetingForm
                          initialValues={{
                            title: currentMeeting.title,
                            date: format(
                              new Date(currentMeeting.meetingDate),
                              "yyyy-MM-dd"
                            ),
                            attendees: (currentMeeting.attendees ?? []).join(", "),
                            transcript: currentMeeting.transcript ?? "",
                            notes: currentMeeting.notes ?? "",
                          }}
                          onSubmit={handleEdit}
                          isPending={updateMeeting.isPending}
                          submitLabel="Save Changes"
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
                        <AlertDialogTitle>Delete meeting?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{meeting.title}" and all its
                          extracted insights.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleDelete(meeting.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {filtered.length > 0 && (
        <CardFooter className="text-xs text-muted-foreground border-t pt-4">
          {filtered.length} meeting{filtered.length !== 1 ? "s" : ""} shown
          {filter !== "all" || search ? ` (filtered from ${meetings?.length ?? 0} total)` : ""}
          {" · "}
          Open any meeting to run AI analysis and view extracted opportunities.
        </CardFooter>
      )}
    </Card>
  );
}
