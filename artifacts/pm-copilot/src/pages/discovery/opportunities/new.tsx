import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Lightbulb, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function NewProductIdea() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    sourceType: "manual",
    category: "",
    urgency: "",
    customerProblem: "",
    suggestedSolution: "",
    businessValue: "",
    owner: "",
  });

  const set = (field: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      toast({ title: "Required fields missing", description: "Title and description are required.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/opportunities", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          category: form.category || null,
          urgency: form.urgency || null,
          customerProblem: form.customerProblem || null,
          suggestedSolution: form.suggestedSolution || null,
          businessValue: form.businessValue || null,
          owner: form.owner || null,
          tags: [],
          status: "new",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const idea = await res.json() as { id: number };
      toast({ title: "Product Idea created", description: `"${form.title}" has been added.` });
      navigate(`/discovery/opportunities/${idea.id}`);
    } catch (err: unknown) {
      toast({
        title: "Failed to create idea",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto w-full space-y-6 animate-in fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/discovery/opportunities">
            <ArrowLeft className="size-4 mr-1" /> Back
          </Link>
        </Button>
      </div>

      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Lightbulb className="size-8 text-primary" />
          New Product Idea
        </h1>
        <p className="text-muted-foreground">Capture a new opportunity. You can run AI analysis after creating it.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Core Information</CardTitle>
            <CardDescription>Required fields that define the idea.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
              <Input
                id="title"
                placeholder="e.g. Bulk export to CSV"
                value={form.title}
                onChange={(e) => set("title")(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
              <Textarea
                id="description"
                placeholder="What is the idea? Why does it matter?"
                rows={4}
                value={form.description}
                onChange={(e) => set("description")(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select value={form.sourceType} onValueChange={set("sourceType")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="customer_feedback">Customer Feedback</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="survey">Survey</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="competitive_analysis">Competitive Analysis</SelectItem>
                    <SelectItem value="internal">Internal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={set("category")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feature_request">Feature Request</SelectItem>
                    <SelectItem value="pain_point">Pain Point</SelectItem>
                    <SelectItem value="market_opportunity">Market Opportunity</SelectItem>
                    <SelectItem value="improvement">Improvement</SelectItem>
                    <SelectItem value="integration">Integration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Urgency</Label>
                <Select value={form.urgency} onValueChange={set("urgency")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select urgency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="owner">Owner</Label>
                <Input
                  id="owner"
                  placeholder="e.g. Sarah, Platform Team"
                  value={form.owner}
                  onChange={(e) => set("owner")(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Context */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Context (optional)</CardTitle>
            <CardDescription>Help AI produce a better analysis by providing upfront context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="customerProblem">Customer Problem</Label>
              <Textarea
                id="customerProblem"
                placeholder="What specific problem are customers experiencing?"
                rows={3}
                value={form.customerProblem}
                onChange={(e) => set("customerProblem")(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suggestedSolution">Suggested Solution</Label>
              <Textarea
                id="suggestedSolution"
                placeholder="Any initial thinking on how to solve this?"
                rows={3}
                value={form.suggestedSolution}
                onChange={(e) => set("suggestedSolution")(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="businessValue">Business Value</Label>
              <Textarea
                id="businessValue"
                placeholder="What is the expected business impact?"
                rows={2}
                value={form.businessValue}
                onChange={(e) => set("businessValue")(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/discovery/opportunities">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Lightbulb className="size-4" />}
            {isSubmitting ? "Creating…" : "Create Product Idea"}
          </Button>
        </div>
      </form>
    </div>
  );
}
