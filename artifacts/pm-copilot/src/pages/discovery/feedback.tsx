import { useState } from "react";
import { useListFeedback, useCreateFeedback, getListFeedbackQueryKey, FeedbackInputDepartment } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Building2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function StakeholderFeedback() {
  const [department, setDepartment] = useState<string>("all");
  const { data: feedback, isLoading } = useListFeedback(
    department === "all" ? undefined : { department }
  );
  
  const createFeedback = useCreateFeedback();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  // Form
  const [formDept, setFormDept] = useState<FeedbackInputDepartment>(FeedbackInputDepartment.sales);
  const [stakeholderName, setStakeholderName] = useState("");
  const [description, setDescription] = useState("");
  const [customerImpact, setCustomerImpact] = useState("");
  const [businessContext, setBusinessContext] = useState("");
  const [urgency, setUrgency] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stakeholderName || !description) return;
    
    createFeedback.mutate({
      data: { 
        department: formDept,
        stakeholderName,
        description,
        customerImpact,
        businessContext,
        urgency
      }
    }, {
      onSuccess: () => {
        toast({ title: "Feedback logged" });
        setOpen(false);
        setStakeholderName(""); setDescription(""); setCustomerImpact(""); setBusinessContext(""); setUrgency("");
        queryClient.invalidateQueries({ queryKey: getListFeedbackQueryKey() });
      }
    });
  };

  const departments = [
    { id: "all", label: "All Departments" },
    { id: "sales", label: "Sales" },
    { id: "customer_success", label: "Customer Success" },
    { id: "support", label: "Support" },
    { id: "marketing", label: "Marketing" },
    { id: "executives", label: "Executives" },
    { id: "engineering", label: "Engineering" },
  ];

  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full space-y-6 animate-in fade-in">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="size-8 text-primary" />
            Stakeholder Feedback
          </h1>
          <p className="text-muted-foreground mt-1">Capture internal requests and market signals from customer-facing teams.</p>
        </div>
        
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="shrink-0 gap-2">
              <Plus className="size-4" /> Add Feedback
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Log Internal Feedback</SheetTitle>
              <SheetDescription>Capture a feature request or pain point from a stakeholder.</SheetDescription>
            </SheetHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Department *</label>
                  <Select value={formDept} onValueChange={(v) => setFormDept(v as FeedbackInputDepartment)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="customer_success">Customer Success</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="executives">Executives</SelectItem>
                      <SelectItem value="engineering">Engineering</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Stakeholder Name *</label>
                  <Input value={stakeholderName} onChange={e => setStakeholderName(e.target.value)} required placeholder="Jane Doe" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">The Request / Feedback *</label>
                <Textarea className="h-24" value={description} onChange={e => setDescription(e.target.value)} required placeholder="What are they asking for or complaining about?" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Customer Impact</label>
                <Textarea className="h-20" value={customerImpact} onChange={e => setCustomerImpact(e.target.value)} placeholder="How does this affect customers?" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Business Context</label>
                <Textarea className="h-20" value={businessContext} onChange={e => setBusinessContext(e.target.value)} placeholder="Deal size at risk? Churn risk?" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Urgency / Timeline</label>
                <Input value={urgency} onChange={e => setUrgency(e.target.value)} placeholder="e.g. Need for Q3 renewal" />
              </div>
              <div className="pt-4 pb-8">
                <Button type="submit" className="w-full" disabled={createFeedback.isPending || !stakeholderName || !description}>
                  {createFeedback.isPending ? "Saving..." : "Log Feedback"}
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </header>

      <div className="bg-card p-2 rounded-lg border shadow-sm">
        <Tabs value={department} onValueChange={setDepartment} className="w-full overflow-x-auto">
          <TabsList className="bg-transparent h-10 p-1 w-max">
            {departments.map(dept => (
              <TabsTrigger key={dept.id} value={dept.id} className="data-[state=active]:bg-secondary">
                {dept.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="p-6 h-48"><Skeleton className="h-full w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (!feedback || feedback.length === 0) ? (
        <div className="text-center py-20 text-muted-foreground border border-dashed rounded-lg bg-card flex flex-col items-center">
          <Users className="size-12 mb-4 text-muted-foreground/30" />
          <p>No feedback found for this department.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {feedback.map((item) => (
            <Card key={item.id} className="hover:border-primary/50 transition-colors flex flex-col">
              <CardHeader className="p-5 pb-3 bg-muted/20 border-b">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className="bg-background">
                    <Building2 className="size-3 mr-1" /> {item.department.replace('_', ' ')}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(item.createdAt), 'MMM d, yyyy')}
                  </span>
                </div>
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="size-6 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                    {item.stakeholderName.charAt(0)}
                  </span>
                  {item.stakeholderName}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 flex-1 space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Feedback</h4>
                  <p className="text-sm text-foreground/90 leading-relaxed font-medium">"{item.description}"</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {item.customerImpact && (
                    <div className="bg-primary/5 p-3 rounded-md border border-primary/10">
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Customer Impact</h4>
                      <p className="text-xs text-foreground/80">{item.customerImpact}</p>
                    </div>
                  )}
                  {item.businessContext && (
                    <div className="bg-warning/10 p-3 rounded-md border border-warning/20">
                      <h4 className="text-xs font-semibold text-warning uppercase tracking-wider mb-1">Business Context</h4>
                      <p className="text-xs text-foreground/80">{item.businessContext}</p>
                    </div>
                  )}
                </div>
              </CardContent>
              {item.urgency && (
                <CardFooter className="p-5 pt-0 mt-2">
                  <div className="w-full flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-md">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span className="font-semibold">Urgent:</span> {item.urgency}
                  </div>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
