import { useState } from "react";
import { Link } from "wouter";
import { useListPrioritization, useAiRecommendPrioritization, getListPrioritizationQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Brain, ArrowUpRight, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
const ListPrioritizationFramework = { rice: 'rice', ice: 'ice', moscow: 'moscow', kano: 'kano' } as const;
type ListPrioritizationFramework = typeof ListPrioritizationFramework[keyof typeof ListPrioritizationFramework];

export default function Prioritization() {
  const [framework, setFramework] = useState<ListPrioritizationFramework>(ListPrioritizationFramework.rice);
  
  const { data: opps, isLoading } = useListPrioritization({ framework });
  const recommend = useAiRecommendPrioritization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleRecommend = () => {
    recommend.mutate({}, {
      onSuccess: () => {
        toast({ title: "AI Prioritization Complete", description: "Opportunities have been scored." });
        queryClient.invalidateQueries({ queryKey: getListPrioritizationQueryKey({ framework }) });
      }
    });
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full space-y-6 animate-in fade-in">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="size-8 text-primary" />
            Prioritization
          </h1>
          <p className="text-muted-foreground mt-1">Score and rank opportunities to build your roadmap.</p>
        </div>
        
        <Button onClick={handleRecommend} disabled={recommend.isPending} className="bg-ai text-ai-foreground hover:bg-ai/90 shadow-sm gap-2">
          <Brain className="size-4" /> {recommend.isPending ? "Scoring..." : "AI Recommend Priority"}
        </Button>
      </header>

      <Tabs value={framework} onValueChange={(v) => setFramework(v as ListPrioritizationFramework)} className="w-full">
        <TabsList className="bg-card border p-1 h-12">
          <TabsTrigger value="rice" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-6 h-10">RICE Score</TabsTrigger>
          <TabsTrigger value="ice" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-6 h-10">ICE Score</TabsTrigger>
          <TabsTrigger value="moscow" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-6 h-10">MoSCoW</TabsTrigger>
          <TabsTrigger value="kano" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-6 h-10">Kano Model</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b">
              <tr>
                <th className="px-6 py-4 font-medium w-16 text-center">Rank</th>
                <th className="px-6 py-4 font-medium">Opportunity</th>
                {framework === 'rice' && (
                  <>
                    <th className="px-6 py-4 font-medium text-center">Reach</th>
                    <th className="px-6 py-4 font-medium text-center">Impact</th>
                    <th className="px-6 py-4 font-medium text-center">Confidence</th>
                    <th className="px-6 py-4 font-medium text-center">Effort</th>
                    <th className="px-6 py-4 font-medium text-center text-primary font-bold">RICE</th>
                  </>
                )}
                {framework === 'ice' && (
                  <>
                    <th className="px-6 py-4 font-medium text-center">Impact</th>
                    <th className="px-6 py-4 font-medium text-center">Confidence</th>
                    <th className="px-6 py-4 font-medium text-center">Ease</th>
                    <th className="px-6 py-4 font-medium text-center text-primary font-bold">ICE</th>
                  </>
                )}
                {framework === 'moscow' && (
                  <th className="px-6 py-4 font-medium">Category</th>
                )}
                {framework === 'kano' && (
                  <th className="px-6 py-4 font-medium">Category</th>
                )}
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-6 mx-auto rounded-full"/></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-64"/></td>
                    <td colSpan={5} className="px-6 py-4"><Skeleton className="h-5 w-full"/></td>
                  </tr>
                ))
              ) : opps?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    No opportunities ready for prioritization. Go to Discovery to mark some as ready.
                  </td>
                </tr>
              ) : (
                opps?.map((item, idx) => (
                  <tr key={item.opportunity.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4 text-center">
                      <div className="size-8 rounded-full bg-secondary flex items-center justify-center font-bold text-muted-foreground mx-auto">
                        {item.overallRank || idx + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-foreground mb-1">{item.opportunity.title}</div>
                      {item.aiRecommendation && (
                        <div className="text-xs text-ai bg-ai/10 px-2 py-1 rounded inline-flex items-center gap-1 mt-1">
                          <Brain className="size-3" /> AI: {item.aiRecommendation}
                        </div>
                      )}
                    </td>
                    
                    {framework === 'rice' && (
                      <>
                        <td className="px-6 py-4 text-center font-mono">{item.riceScore?.reach || '-'}</td>
                        <td className="px-6 py-4 text-center font-mono">{item.riceScore?.impact || '-'}</td>
                        <td className="px-6 py-4 text-center font-mono">{item.riceScore?.confidence ? `${item.riceScore.confidence}%` : '-'}</td>
                        <td className="px-6 py-4 text-center font-mono">{item.riceScore?.effort || '-'}</td>
                        <td className="px-6 py-4 text-center font-mono font-bold text-primary text-base bg-primary/5">
                          {item.riceScore?.score?.toFixed(1) || '-'}
                        </td>
                      </>
                    )}
                    
                    {framework === 'ice' && (
                      <>
                        <td className="px-6 py-4 text-center font-mono">{item.iceScore?.impact || '-'}</td>
                        <td className="px-6 py-4 text-center font-mono">{item.iceScore?.confidence ? `${item.iceScore.confidence}%` : '-'}</td>
                        <td className="px-6 py-4 text-center font-mono">{item.iceScore?.ease || '-'}</td>
                        <td className="px-6 py-4 text-center font-mono font-bold text-primary text-base bg-primary/5">
                          {item.iceScore?.score?.toFixed(1) || '-'}
                        </td>
                      </>
                    )}
                    
                    {framework === 'moscow' && (
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="uppercase">{item.moscowCategory?.replace('_', ' ') || 'Unscored'}</Badge>
                      </td>
                    )}
                    
                    {framework === 'kano' && (
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="uppercase">{item.kanoCategory || 'Unscored'}</Badge>
                      </td>
                    )}

                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/discovery/opportunities/${item.opportunity.id}`}>
                          View <ArrowUpRight className="size-3 ml-1" />
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
