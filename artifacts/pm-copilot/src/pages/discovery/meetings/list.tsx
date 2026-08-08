import { useState } from "react";
import { Link } from "wouter";
import { useListMeetings, useCreateMeeting, getListMeetingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Video, Calendar, Users, Plus, BrainCircuit, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function MeetingsList() {
  const { data: meetings, isLoading } = useListMeetings();
  const createMeeting = useCreateMeeting();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  // Form
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [attendees, setAttendees] = useState("");
  const [transcript, setTranscript] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date) return;
    
    createMeeting.mutate({
      data: { 
        title, 
        meetingDate: new Date(date).toISOString(), 
        attendees: attendees.split(',').map(a => a.trim()).filter(Boolean),
        transcript,
        notes 
      }
    }, {
      onSuccess: () => {
        toast({ title: "Meeting logged", description: "Ready for analysis." });
        setOpen(false);
        setTitle(""); setDate(format(new Date(), 'yyyy-MM-dd')); setAttendees(""); setTranscript(""); setNotes("");
        queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
      }
    });
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full space-y-6 animate-in fade-in">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Video className="size-8 text-primary" />
            Customer Meetings
          </h1>
          <p className="text-muted-foreground mt-1">Upload call transcripts for AI to extract product opportunities.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 gap-2">
              <Plus className="size-4" /> Log Meeting
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Log Customer Meeting</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Meeting Title *</label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date *</label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Attendees</label>
                <Input placeholder="e.g. John Doe, Acme Corp" value={attendees} onChange={e => setAttendees(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <BrainCircuit className="size-4 text-ai"/> Transcript (For AI Analysis)
                </label>
                <Textarea placeholder="Paste Zoom/Gong/Fireflies transcript here..." className="h-48 font-mono text-xs bg-muted/30" value={transcript} onChange={e => setTranscript(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Manual Notes</label>
                <Textarea className="h-20" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={createMeeting.isPending || !title}>
                  {createMeeting.isPending ? "Saving..." : "Save Meeting"}
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
      ) : (!meetings || meetings.length === 0) ? (
        <div className="text-center py-20 text-muted-foreground border border-dashed rounded-lg bg-card">
          No meetings logged. Upload a transcript to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {meetings.map((meeting) => (
            <Card key={meeting.id} className="hover:border-primary/50 transition-colors flex flex-col group">
              <CardHeader className="p-5 pb-3">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant={meeting.analyzed ? "secondary" : "outline"} className={meeting.analyzed ? "bg-ai/10 text-ai hover:bg-ai/20" : ""}>
                    {meeting.analyzed ? "Analyzed" : "Pending Analysis"}
                  </Badge>
                  {meeting.opportunitiesExtracted ? (
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                      {meeting.opportunitiesExtracted} Opps Found
                    </Badge>
                  ) : null}
                </div>
                <CardTitle className="text-lg leading-snug group-hover:text-primary transition-colors">
                  {meeting.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-2 flex-1">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 shrink-0" />
                    <span>{format(new Date(meeting.meetingDate), 'MMMM d, yyyy')}</span>
                  </div>
                  {meeting.attendees && meeting.attendees.length > 0 && (
                    <div className="flex items-start gap-2">
                      <Users className="size-4 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{meeting.attendees.join(', ')}</span>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="p-5 pt-0 mt-auto">
                <Button variant="secondary" className="w-full justify-between" asChild>
                  <Link href={`/discovery/meetings/${meeting.id}`}>
                    View Details <ExternalLink className="size-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
