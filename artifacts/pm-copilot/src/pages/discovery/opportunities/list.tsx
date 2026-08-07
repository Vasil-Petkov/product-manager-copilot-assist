import { useState } from "react";
import { Link } from "wouter";
import { useListOpportunities } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Filter, Lightbulb, BrainCircuit } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS = {
  new: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  under_review: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  ready_for_prioritization: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  archived: "bg-slate-500/10 text-slate-600 border-slate-500/20"
};

export default function OpportunitiesList() {
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  
  const { data: opps, isLoading } = useListOpportunities({ 
    status: status === "all" ? undefined : status,
    search: search || undefined
  });

  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full space-y-6 animate-in fade-in">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Lightbulb className="size-8 text-primary" />
            Opportunities
          </h1>
          <p className="text-muted-foreground mt-1">Discovered problems and feature requests waiting to be addressed.</p>
        </div>
        <Button className="shrink-0 gap-2">
          <Plus className="size-4" /> New Opportunity
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
              placeholder="Search opportunities..." 
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
                <th className="px-6 py-4 font-medium">Opportunity</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Source</th>
                <th className="px-6 py-4 font-medium">AI Match</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
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
              ) : opps?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    No opportunities found matching your criteria.
                  </td>
                </tr>
              ) : (
                opps?.map((opp) => (
                  <tr key={opp.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">{opp.title}</div>
                      <div className="text-muted-foreground line-clamp-1 max-w-xl">{opp.description}</div>
                      <div className="flex gap-2 mt-2">
                        {opp.category && <Badge variant="secondary" className="text-[10px]">{opp.category}</Badge>}
                        <span className="text-[10px] text-muted-foreground flex items-center">
                          Created {format(new Date(opp.createdAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={STATUS_COLORS[opp.status as keyof typeof STATUS_COLORS] || ""}>
                        {opp.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                        {opp.sourceType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {opp.confidenceScore ? (
                        <div className="flex items-center gap-1.5 text-ai font-medium">
                          <BrainCircuit className="size-4" />
                          {Math.round(opp.confidenceScore * 100)}%
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Unscored</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/discovery/opportunities/${opp.id}`}>
                          View
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
