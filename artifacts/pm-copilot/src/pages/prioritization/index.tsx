import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3, Lightbulb, Table2, GitCompare, Trophy } from "lucide-react";
import { HelpTooltip } from "@/components/help-tooltip";
import DashboardTab from "./dashboard-tab";
import IdeasTab from "./ideas-tab";
import ResultsTab from "./results-tab";
import CompareTab from "./compare-tab";
import ExecutiveTab from "./executive-tab";

export default function Prioritization() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full space-y-6 animate-in fade-in">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="size-8 text-primary" />
            Prioritization
            <HelpTooltip
              purpose="Decide what to build next using 7 prioritization frameworks combined with AI."
              bullets={[
                "Score ideas with RICE, ICE, MoSCoW, and more",
                "AI analyzes each idea across all frameworks",
                "Compare two ideas side-by-side",
                "Get one consolidated executive recommendation",
              ]}
            />
          </h1>
          <p className="text-muted-foreground mt-1">
            Score, rank and compare Product Ideas using 7 frameworks — combined into one AI recommendation.
          </p>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="bg-muted p-1 mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard" className="flex items-center gap-2 data-[state=active]:bg-card">
            <BarChart3 className="size-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="ideas" className="flex items-center gap-2 data-[state=active]:bg-card">
            <Lightbulb className="size-4" /> Product Ideas
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2 data-[state=active]:bg-card">
            <Table2 className="size-4" /> Prioritization Results
          </TabsTrigger>
          <TabsTrigger value="compare" className="flex items-center gap-2 data-[state=active]:bg-card">
            <GitCompare className="size-4" /> Feature Comparison
          </TabsTrigger>
          <TabsTrigger value="executive" className="flex items-center gap-2 data-[state=active]:bg-card">
            <Trophy className="size-4" /> Executive Recommendation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><DashboardTab onNavigate={setTab} /></TabsContent>
        <TabsContent value="ideas"><IdeasTab /></TabsContent>
        <TabsContent value="results"><ResultsTab /></TabsContent>
        <TabsContent value="compare"><CompareTab /></TabsContent>
        <TabsContent value="executive"><ExecutiveTab onNavigate={setTab} /></TabsContent>
      </Tabs>
    </div>
  );
}
