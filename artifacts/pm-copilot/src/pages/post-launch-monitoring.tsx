import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Filter,
  Lightbulb,
  MessageSquare,
  Minus,
  Search,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  useGetRoadmap,
  useListFeedback,
  useListOpportunities,
  useListPrioritization,
  useListSignals,
  useListValidationExperiments,
  useListValidationHypotheses,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Metric = {
  id: string;
  name: string;
  value: string;
  change: string;
  direction: "up" | "down" | "flat";
  points: number[];
  category: "business" | "customer" | "engagement" | "adoption" | "aaarrr" | "heart";
  framework?: "AARRR" | "HEART";
};

type MetricGroup = {
  id: Metric["category"];
  title: string;
  metrics: Metric[];
};

const metric = (
  id: string,
  name: string,
  value: string,
  change: string,
  direction: Metric["direction"],
  points: number[],
  category: Metric["category"],
  framework?: Metric["framework"],
): Metric => ({ id, name, value, change, direction, points, category, framework });

const metricGroups: MetricGroup[] = [
  {
    id: "business",
    title: "Business & Financial Metrics",
    metrics: [
      metric("mrr", "Monthly Recurring Revenue (MRR)", "$68K", "12%", "up", [32, 34, 33, 39, 41, 46, 48], "business"),
      metric("arr", "Annual Recurring Revenue (ARR)", "$816K", "10%", "up", [28, 29, 31, 34, 36, 40, 43], "business"),
      metric("new-mrr", "New Monthly Recurring Revenue", "$9.4K", "6%", "up", [20, 24, 22, 25, 28, 27, 32], "business"),
      metric("churn", "Churn Rate", "2.1%", "8%", "down", [41, 40, 42, 36, 34, 32, 30], "business"),
      metric("arpu", "Average Revenue Per User (ARPU)", "$56", "7%", "up", [26, 27, 28, 31, 33, 35, 38], "business"),
      metric("ltv", "Customer Lifetime Value (CLV / LTV)", "$1,240", "9%", "up", [28, 30, 31, 35, 37, 38, 42], "business"),
      metric("ltv-cac", "Customer Lifetime Value to Customer Acquisition Cost Ratio (LTV:CAC Ratio)", "3.8x", "0.4", "up", [22, 24, 25, 28, 31, 30, 35], "business"),
      metric("gross-revenue", "Gross Revenue", "$82K", "11%", "up", [31, 33, 35, 37, 40, 43, 46], "business"),
      metric("bookings", "Bookings", "$94K", "13%", "up", [30, 33, 34, 38, 41, 45, 49], "business"),
      metric("gross-margin", "Gross Margin", "78%", "2 percentage points", "up", [68, 70, 71, 73, 74, 76, 78], "business"),
      metric("nrr", "Net Revenue Retention (NRR)", "112%", "4 percentage points", "up", [98, 100, 102, 105, 107, 110, 112], "business"),
      metric("quick-ratio", "SaaS Quick Ratio", "3.2", "0.3", "up", [24, 25, 27, 28, 30, 31, 33], "business"),
      metric("payback", "Customer Acquisition Cost Payback Period", "9.4 mo", "6%", "down", [39, 38, 37, 35, 34, 32, 30], "business"),
      metric("acv", "Average Contract Value (ACV)", "$14.2K", "8%", "up", [25, 27, 29, 30, 33, 35, 38], "business"),
      metric("cac", "Customer Acquisition Cost (CAC)", "$326", "5%", "down", [38, 37, 36, 35, 34, 32, 31], "business"),
      metric("expansion-mrr", "Expansion Monthly Recurring Revenue", "$4.8K", "12%", "up", [18, 19, 22, 25, 27, 30, 34], "business"),
      metric("contraction-mrr", "Contraction Monthly Recurring Revenue", "$1.1K", "4%", "down", [20, 19, 18, 17, 16, 15, 14], "business"),
      metric("refund-rate", "Refund Rate", "1.4%", "0.3 percentage points", "down", [24, 23, 22, 21, 20, 19, 18], "business"),
      metric("discount-rate", "Average Discount Rate", "8.2%", "1.1 percentage points", "down", [31, 30, 29, 27, 26, 25, 24], "business"),
    ],
  },
  {
    id: "customer",
    title: "Customer & Conversion Metrics",
    metrics: [
      metric("ctr", "Click-Through Rate (CTR)", "2.1%", "0.4 percentage points", "up", [24, 23, 26, 29, 28, 32, 36], "customer"),
      metric("cpc", "Cost Per Click (CPC)", "$1.84", "5%", "down", [37, 35, 36, 33, 31, 29, 28], "customer"),
      metric("cpa", "Cost Per Acquisition (CPA)", "$42", "6%", "down", [42, 40, 39, 35, 34, 31, 30], "customer"),
      metric("lead-conversion", "Lead Conversion Rate", "8.6%", "1.2 percentage points", "up", [20, 22, 21, 25, 27, 31, 34], "customer"),
      metric("signup", "Visitor-to-Signup Rate", "6.8%", "0.8 percentage points", "up", [18, 20, 22, 21, 25, 27, 30], "customer"),
      metric("trial-paid", "Trial-to-Paid Conversion", "18.4%", "2.3 percentage points", "up", [18, 18, 21, 24, 23, 27, 31], "customer"),
      metric("nps", "Net Promoter Score (NPS)", "42", "5", "down", [46, 48, 45, 44, 43, 42, 42], "customer"),
      metric("csat", "Customer Satisfaction (CSAT)", "4.3", "0.2", "down", [45, 46, 45, 44, 43, 43, 42], "customer"),
      metric("trial-signup", "Trial Signup Rate", "12.6%", "1.4 percentage points", "up", [15, 17, 18, 20, 22, 24, 27], "customer"),
      metric("signup-rate", "Signup Rate", "7.9%", "0.7 percentage points", "up", [18, 19, 21, 22, 24, 26, 28], "customer"),
      metric("free-paid", "Free-to-Paid Conversion Rate", "7.2%", "0.9 percentage points", "up", [14, 15, 17, 18, 20, 22, 24], "customer"),
      metric("demo-customer", "Demo-to-Customer Conversion Rate", "21%", "2.1 percentage points", "up", [16, 17, 18, 19, 21, 22, 24], "customer"),
      metric("lead-customer", "Lead-to-Customer Conversion Rate", "11.8%", "1.6 percentage points", "up", [12, 14, 15, 16, 18, 20, 22], "customer"),
      metric("customer-conversion", "Customer Conversion Rate", "4.2%", "0.6 percentage points", "up", [18, 19, 20, 22, 23, 25, 27], "customer"),
      metric("customer-churn", "Customer Churn Rate", "2.1%", "8%", "down", [41, 40, 42, 36, 34, 32, 30], "customer"),
      metric("retention", "Customer Retention Rate", "94%", "2 percentage points", "up", [88, 89, 90, 91, 92, 93, 94], "customer"),
      metric("renewal", "Customer Renewal Rate", "91%", "3 percentage points", "up", [82, 84, 85, 87, 88, 89, 91], "customer"),
      metric("ces", "Customer Effort Score (CES)", "2.4", "0.3", "down", [39, 37, 35, 33, 31, 29, 27], "customer"),
      metric("complaints", "Customer Complaint Rate", "0.8%", "0.2 percentage points", "down", [22, 21, 20, 19, 18, 17, 16], "customer"),
      metric("tickets", "Customer Support Ticket Volume", "184", "9%", "down", [38, 37, 35, 34, 32, 30, 29], "customer"),
      metric("response-time", "Customer Support Response Time", "2h 18m", "12%", "down", [42, 40, 38, 36, 34, 32, 30], "customer"),
      metric("resolution-time", "Customer Support Resolution Time", "9h 42m", "8%", "down", [44, 42, 41, 39, 37, 36, 35], "customer"),
    ],
  },
  {
    id: "engagement",
    title: "Engagement & Usage Metrics",
    metrics: [
      metric("active-users", "Active Users", "4,812", "14%", "up", [24, 28, 29, 33, 35, 39, 44], "engagement"),
      metric("dau", "Daily Active Users (DAU)", "1,248", "18%", "up", [22, 24, 29, 30, 35, 40, 46], "engagement"),
      metric("wau", "Weekly Active Users (WAU)", "3,940", "16%", "up", [25, 28, 31, 33, 35, 39, 43], "engagement"),
      metric("mau", "Monthly Active Users (MAU)", "8,560", "15%", "up", [26, 29, 33, 35, 36, 40, 45], "engagement"),
      metric("stickiness", "Daily Active Users to Monthly Active Users Stickiness (DAU/MAU Stickiness)", "14.6%", "1.1 percentage points", "up", [18, 20, 20, 23, 24, 27, 29], "engagement"),
      metric("sessions", "Sessions Per User", "3.7", "8%", "up", [20, 22, 24, 23, 27, 29, 32], "engagement"),
      metric("duration", "Session Duration", "8m 24s", "9%", "up", [22, 25, 24, 28, 31, 33, 37], "engagement"),
      metric("task-success", "Task Success Rate", "91.4%", "3.2 percentage points", "up", [70, 72, 73, 75, 78, 81, 84], "engagement"),
      metric("new-active", "New Active Users", "642", "13%", "up", [18, 20, 22, 25, 27, 30, 34], "engagement"),
      metric("returning-active", "Returning Active Users", "4,170", "15%", "up", [27, 29, 31, 34, 36, 40, 44], "engagement"),
      metric("frequency", "Session Frequency", "2.8 / week", "7%", "up", [17, 18, 20, 21, 23, 25, 27], "engagement"),
      metric("actions-session", "Actions Per Session", "6.4", "11%", "up", [20, 21, 23, 25, 28, 30, 33], "engagement"),
      metric("usage-frequency", "Feature Usage Frequency", "4.1 / week", "9%", "up", [22, 24, 25, 27, 29, 31, 34], "engagement"),
      metric("usage-depth", "Feature Usage Depth", "3.6 steps", "5%", "up", [18, 20, 21, 23, 25, 26, 28], "engagement"),
      metric("key-feature-users", "Percentage of Users Using Key Feature", "46%", "6 percentage points", "up", [25, 27, 29, 31, 34, 38, 42], "engagement"),
      metric("returning-users", "Returning Users", "3,920", "12%", "up", [25, 27, 29, 31, 34, 37, 40], "engagement"),
      metric("activation", "Activation Rate", "34%", "5 percentage points", "up", [20, 21, 23, 25, 27, 30, 34], "engagement"),
      metric("time-activation", "Time to Activation", "2d 6h", "14%", "down", [42, 41, 39, 37, 35, 33, 31], "engagement"),
      metric("activation-completion", "Activation Completion Rate", "72%", "4 percentage points", "up", [52, 54, 57, 59, 62, 66, 72], "engagement"),
      metric("onboarding", "Onboarding Completion Rate", "68%", "3 percentage points", "up", [54, 55, 57, 59, 61, 64, 68], "engagement"),
      metric("first-action", "Time to First Key Action", "18m", "10%", "down", [38, 37, 35, 34, 32, 30, 28], "engagement"),
      metric("day-one", "Day 1 Retention", "62%", "2 percentage points", "up", [54, 55, 56, 57, 58, 60, 62], "engagement"),
      metric("day-seven", "Day 7 Retention", "48%", "3 percentage points", "up", [30, 31, 34, 35, 37, 42, 48], "engagement"),
    ],
  },
  {
    id: "adoption",
    title: "Product Adoption Metrics",
    metrics: [
      metric("feature-adoption", "Feature Adoption Rate", "28%", "7 percentage points", "up", [14, 15, 17, 20, 22, 25, 28], "adoption"),
      metric("feature-activation", "Feature Activation Rate", "34%", "5 percentage points", "up", [20, 21, 23, 25, 27, 30, 34], "adoption"),
      metric("target-customers", "% of Target Customers Using Feature", "31%", "4 percentage points", "up", [18, 20, 22, 23, 25, 28, 31], "adoption"),
      metric("cohort-growth", "Adoption Growth Rate", "11.2%", "2.4 percentage points", "up", [14, 16, 18, 17, 21, 23, 26], "adoption"),
      metric("repeat-usage", "Repeat Usage Rate", "64%", "6 percentage points", "up", [47, 49, 51, 54, 55, 59, 64], "adoption"),
      metric("feature-dropoff", "Feature Drop-off Rate", "12%", "3 percentage points", "down", [26, 25, 24, 22, 20, 18, 17], "adoption"),
      metric("power-users", "Power Users %", "9.8%", "1.7 percentage points", "up", [5, 6, 6, 7, 8, 8, 10], "adoption"),
      metric("segment-adoption", "Adoption by Customer Segment", "34%", "5 percentage points", "up", [20, 21, 23, 25, 27, 30, 34], "adoption"),
      metric("cohort-adoption", "Adoption by Cohort", "29%", "4 percentage points", "up", [18, 19, 21, 23, 24, 27, 29], "adoption"),
      metric("feature-retention", "Feature Retention", "71%", "6 percentage points", "up", [52, 55, 58, 60, 63, 67, 71], "adoption"),
      metric("usage-depth-adoption", "Depth of Feature Usage", "3.6 steps", "5%", "up", [18, 20, 21, 23, 25, 26, 28], "adoption"),
      metric("features-per-user", "Number of Features Used per User", "4.2", "8%", "up", [20, 22, 24, 25, 28, 30, 33], "adoption"),
    ],
  },
  {
    id: "aaarrr",
    title: "AARRR Funnel",
    metrics: [
      metric("a-acquisition", "Click-Through Rate (CTR)", "2.1%", "0.4 percentage points", "up", [20, 22, 24, 25, 27, 29, 31], "aaarrr", "AARRR"),
      metric("a-activation", "Activation Rate", "34%", "5 percentage points", "up", [20, 21, 22, 24, 26, 29, 34], "aaarrr", "AARRR"),
      metric("a-retention", "Day 7 Retention", "48%", "3 percentage points", "up", [30, 31, 34, 35, 37, 42, 48], "aaarrr", "AARRR"),
      metric("a-referral", "Referral Rate", "12%", "1.8 percentage points", "up", [7, 8, 9, 9, 10, 11, 12], "aaarrr", "AARRR"),
      metric("a-revenue", "Monthly Recurring Revenue (MRR)", "$68K", "12%", "up", [32, 34, 33, 39, 41, 46, 48], "aaarrr", "AARRR"),
    ],
  },
  {
    id: "heart",
    title: "HEART Metrics",
    metrics: [
      metric("h-happiness", "Net Promoter Score (NPS)", "42", "5", "down", [46, 48, 45, 44, 43, 42, 42], "heart", "HEART"),
      metric("h-engagement", "Daily Active Users (DAU)", "1,248", "18%", "up", [22, 24, 29, 30, 35, 40, 46], "heart", "HEART"),
      metric("h-adoption", "Feature Adoption Rate", "28%", "7 percentage points", "up", [14, 15, 17, 20, 22, 25, 28], "heart", "HEART"),
      metric("h-retention", "Churn Rate", "2.1%", "8%", "down", [41, 40, 42, 36, 34, 32, 30], "heart", "HEART"),
      metric("h-task", "Task Success Rate", "91.4%", "3.2 percentage points", "up", [70, 72, 73, 75, 78, 81, 84], "heart", "HEART"),
    ],
  },
];

const tabDescriptions: Record<string, { title: string; description: string; icon: typeof Activity }> = {
  overview: { title: "Launch outcome overview", description: "A concise readout of how the launch is performing against its intended outcomes.", icon: Activity },
  goals: { title: "Goals & OKRs", description: "Review the launch outcomes defined in Go To Market and their future measurement links.", icon: Target },
  metrics: { title: "Metrics", description: "Monitor the product signals that will eventually be connected to live analytics sources.", icon: BarChart3 },
  feedback: { title: "Feedback", description: "Bring post-launch customer and stakeholder feedback into the outcome review.", icon: MessageSquare },
  risks: { title: "Risks & Issues", description: "Track signals that may put adoption, customer value, or launch outcomes at risk.", icon: ShieldAlert },
  review: { title: "Review & Learn", description: "Capture the launch review, learnings, and decisions for the next iteration.", icon: BookOpen },
  recommendations: { title: "Recommendations", description: "Collect evidence-based follow-up ideas once enough post-launch signal is available.", icon: Lightbulb },
};

function Sparkline({ points, tone }: { points: number[]; tone: "positive" | "negative" | "neutral" }) {
  const width = 76;
  const height = 28;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const coordinates = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point - min) / range) * (height - 5) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  const stroke = tone === "positive" ? "rgb(16 185 129)" : tone === "negative" ? "rgb(244 63 94)" : "rgb(148 163 184)";
  return (
    <svg aria-hidden="true" className="h-7 w-[76px] shrink-0" viewBox={`0 0 ${width} ${height}`}>
      <polyline points={coordinates} fill="none" stroke={stroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function Trend({ metric: currentMetric }: { metric: Metric }) {
  const change = currentMetric.change;
  if (currentMetric.direction === "flat") {
    return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="size-3" /> {change}</span>;
  }
  const isUp = currentMetric.direction === "up";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${isUp ? "text-emerald-600" : "text-rose-600"}`}>
      {isUp ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {change}
    </span>
  );
}

function MetricRow({ currentMetric }: { currentMetric: Metric }) {
  const tone = currentMetric.direction === "up" ? "positive" : currentMetric.direction === "down" ? "negative" : "neutral";
  return (
    <div className="flex items-center gap-3 border-b py-3 last:border-b-0">
      <p className="min-w-0 flex-1 text-sm leading-5">{currentMetric.name}</p>
      <div className="w-[128px] shrink-0 text-right">
        <p className="text-sm font-semibold">{currentMetric.value}</p>
        <Trend metric={currentMetric} />
      </div>
      <Sparkline points={currentMetric.points} tone={tone} />
    </div>
  );
}

function MetricCard({
  group,
  metrics,
  totalCount,
  onViewAll,
}: {
  group: MetricGroup;
  metrics: Metric[];
  totalCount: number;
  onViewAll: () => void;
}) {
  const isAaarrr = group.id === "aaarrr";
  const isHeart = group.id === "heart";
  return (
    <Card className="h-full shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <div className="min-w-0">
          <CardTitle className="text-base">{group.title} ({totalCount})</CardTitle>
          <CardDescription className="mt-1">
            {isAaarrr ? "Acquisition → Activation → Retention → Referral → Revenue" : isHeart ? "Happiness → Engagement → Adoption → Retention → Task success" : group.id === "adoption" ? "Sample values · Percentage-point changes indicate the absolute change between two percentage values." : "Sample values · future live source"}
          </CardDescription>
        </div>
        <Button type="button" variant="ghost" size="sm" className="shrink-0 gap-1 px-2 text-xs text-primary" onClick={onViewAll}>
          View all <ChevronRight className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="pt-2">
        {isAaarrr && (
          <div className="mb-2 flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
            {["A", "A", "R", "R", "R"].map((letter, index) => (
              <div key={`${letter}-${index}`} className="flex items-center gap-2 last:gap-0">
                <span className="flex size-7 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold text-primary">{letter}</span>
                {index < 4 && <ChevronRight className="size-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
        )}
        {isHeart && (
          <div className="mb-2 grid grid-cols-5 gap-1 rounded-md bg-muted/40 px-2 py-2 text-center text-[10px] font-medium text-muted-foreground">
            {["Happiness", "Engagement", "Adoption", "Retention", "Task success"].map((label) => <span key={label}>{label}</span>)}
          </div>
        )}
        {metrics.length > 0 ? metrics.slice(0, 7).map((currentMetric) => <MetricRow key={currentMetric.id} currentMetric={currentMetric} />) : (
          <p className="py-6 text-center text-sm text-muted-foreground">No metrics match the current filters.</p>
        )}
        {group.metrics.length > metrics.slice(0, 7).length && (
          <p className="pt-3 text-xs text-muted-foreground">+ {group.metrics.length - metrics.slice(0, 7).length} more metrics in this view</p>
        )}
      </CardContent>
    </Card>
  );
}

function PlaceholderTab({ tab }: { tab: string }) {
  const copy = tabDescriptions[tab];
  const Icon = copy.icon;
  return (
    <Card className="border-dashed shadow-sm">
      <CardContent className="flex min-h-[270px] flex-col items-center justify-center px-6 py-12 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-6" /></div>
        <h2 className="text-lg font-semibold">{copy.title}</h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">{copy.description}</p>
        <Badge variant="outline" className="mt-5">V1 foundation · coming next</Badge>
      </CardContent>
    </Card>
  );
}

export default function PostLaunchMonitoring() {
  const [selectedId, setSelectedId] = useState("");
  const [activeTab, setActiveTab] = useState("metrics");
  const [category, setCategory] = useState("all");
  const [framework, setFramework] = useState("all");
  const [search, setSearch] = useState("");
  const [viewBy, setViewBy] = useState("recent");
  const [period, setPeriod] = useState("30");
  const [viewAllGroup, setViewAllGroup] = useState<MetricGroup | null>(null);

  const { data: opportunities = [] } = useListOpportunities({});
  const { data: roadmap } = useGetRoadmap();
  const { data: feedback = [] } = useListFeedback({});
  const { data: signals = [] } = useListSignals({});
  const { data: hypotheses = [] } = useListValidationHypotheses({});
  const { data: experiments = [] } = useListValidationExperiments({});
  const { data: prioritization = [] } = useListPrioritization({});

  const selectedOpportunityId = selectedId ? Number(selectedId) : undefined;
  const opportunity = opportunities.find((item) => item.id === selectedOpportunityId);
  const roadmapItems = roadmap?.items.filter((item) => item.opportunityId === selectedOpportunityId) ?? [];
  const launchItem = roadmapItems[0];
  const selectedFeedback = feedback.filter((item) => item.opportunityId === selectedOpportunityId);
  const selectedSignals = signals.filter((item) => item.opportunityId === selectedOpportunityId);
  const selectedHypotheses = hypotheses.filter((item) => item.opportunityId === selectedOpportunityId);
  const selectedExperiments = experiments.filter((item) => selectedHypotheses.some((hypothesis) => hypothesis.id === item.hypothesisId));
  const priority = prioritization.find((item) => item.opportunity?.id === selectedOpportunityId);

  const allMetrics = useMemo(() => metricGroups.flatMap((group) => group.metrics), []);
  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    return metricGroups.map((group) => ({
      ...group,
      metrics: group.metrics.filter((currentMetric) => {
        const matchesSearch = !query || currentMetric.name.toLowerCase().includes(query);
        const matchesCategory = category === "all" || currentMetric.category === category;
        const matchesFramework = framework === "all" || currentMetric.framework === framework;
        return matchesSearch && matchesCategory && matchesFramework;
      }),
    }));
  }, [category, framework, search]);

  const clearFilters = () => {
    setCategory("all");
    setFramework("all");
    setSearch("");
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-6 md:p-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight"><Activity className="size-8 text-primary" /> Post Launch Monitoring</h1>
          <Badge variant="secondary">V1 foundation</Badge>
          <Badge variant="outline">Demo data</Badge>
        </div>
        <p className="max-w-4xl text-muted-foreground">
          Track whether a launched Product Idea is delivering the outcomes defined in the product lifecycle. Metrics below are sample values until live analytics sources are connected.
        </p>
      </header>

      <Card className="border-primary/20 bg-primary/[0.025]">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(0,360px)_1fr] lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="post-launch-product-idea">Select Product Idea</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger id="post-launch-product-idea" className="bg-background"><SelectValue placeholder="Select a Product Idea" /></SelectTrigger>
              <SelectContent>
                {opportunities.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border bg-background/70 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Product Idea</p>
              <p className="mt-1 truncate text-sm font-medium">{opportunity?.title || "Not defined yet"}</p>
            </div>
            <div className="rounded-md border bg-background/70 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Launch status</p>
              <p className="mt-1 text-sm font-medium">{launchItem?.status || "Not defined yet"}</p>
            </div>
            <div className="rounded-md border bg-background/70 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Launch date / version</p>
              <p className="mt-1 text-sm font-medium">{launchItem?.startDate || "Not defined yet"}{launchItem?.endDate ? ` · delivery ${launchItem.endDate}` : ""}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex min-w-max">
            {Object.keys(tabDescriptions).map((tab) => <TabsTrigger key={tab} value={tab}>{tab === "goals" ? "Goals & OKRs" : tab === "risks" ? "Risks & Issues" : tab === "review" ? "Review & Learn" : tab.charAt(0).toUpperCase() + tab.slice(1)}</TabsTrigger>)}
          </TabsList>
        </div>

        <TabsContent value="metrics" className="mt-0 space-y-5">
          <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
            <Card className="h-fit shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><Filter className="size-4 text-primary" /> Metric filters</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Metric Categories</p>
                  {[
                    ["all", "All Metrics"],
                    ["business", "Business & Financial"],
                    ["customer", "Customer & User"],
                    ["engagement", "Engagement & Usage"],
                    ["adoption", "Product Adoption"],
                  ].map(([value, label]) => (
                    <Button key={value} type="button" variant={category === value ? "secondary" : "ghost"} className="h-8 w-full justify-start px-2 text-sm" onClick={() => setCategory(value)}>{label}</Button>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Frameworks</p>
                  {[["all", "All Frameworks"], ["AARRR", "AARRR"], ["HEART", "HEART"]].map(([value, label]) => (
                    <Button key={value} type="button" variant={framework === value ? "secondary" : "ghost"} className="h-8 w-full justify-start px-2 text-sm" onClick={() => setFramework(value)}>{label}</Button>
                  ))}
                </div>
                {(category !== "all" || framework !== "all" || search) && <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" onClick={clearFilters}><X className="size-3.5" /> Clear filters</Button>}
              </CardContent>
            </Card>

            <div className="min-w-0 space-y-5">
              <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-sm md:flex-row md:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search metrics" className="pl-9" aria-label="Search metrics" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={viewBy} onValueChange={setViewBy}>
                    <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="recent">View by · Recent Activity</SelectItem><SelectItem value="change">View by · Biggest Change</SelectItem><SelectItem value="name">View by · Name</SelectItem></SelectContent>
                  </Select>
                  <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="w-[140px]"><CalendarDays className="mr-2 size-4" /><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="text-sm font-medium">Metrics workspace</p><p className="text-xs text-muted-foreground">{allMetrics.length} sample metrics · showing the last {period} days · {viewBy === "recent" ? "recent activity" : viewBy === "change" ? "biggest change" : "alphabetical order"}</p></div>
                <Badge variant="outline">Demo values only</Badge>
              </div>
              <div className="grid gap-5 2xl:grid-cols-2">
                {filteredGroups.map((group) => (
                  <MetricCard
                    key={group.id}
                    group={group}
                    metrics={group.metrics}
                    totalCount={metricGroups.find((source) => source.id === group.id)?.metrics.length ?? group.metrics.length}
                    onViewAll={() => setViewAllGroup(metricGroups.find((source) => source.id === group.id) ?? group)}
                  />
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="overview" className="mt-0 space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["Metrics tracked", `${allMetrics.length}`, "Sample metric definitions"],
              ["GTM OKRs", "Not connected", "Will use persisted launch outcomes"],
              ["Feedback signals", `${selectedFeedback.length || "Not defined yet"}`, "Linked to this Product Idea"],
              ["RICE score", `${priority?.riceScore?.score ?? "Not defined yet"}`, "Existing prioritization context"],
            ].map(([label, value, detail]) => <Card key={label}><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card>)}
          </div>
          <PlaceholderTab tab="overview" />
        </TabsContent>
        <TabsContent value="goals" className="mt-0 space-y-5">
          <Card className="border-primary/20 bg-primary/[0.025]"><CardContent className="flex gap-3 p-5"><Target className="mt-0.5 size-5 shrink-0 text-primary" /><div><h2 className="font-semibold">Monitoring against GTM OKRs</h2><p className="mt-1 text-sm text-muted-foreground">This page is designed to consume the objectives, Key Results, selected KPIs, target values, and timeframes from Go To Market. V1 keeps those controls session-only, so saved OKRs will appear here once shared persistence is available.</p></div></CardContent></Card>
          <PlaceholderTab tab="goals" />
        </TabsContent>
        {["feedback", "risks", "review", "recommendations"].map((tab) => <TabsContent key={tab} value={tab} className="mt-0 space-y-5"><PlaceholderTab tab={tab} /></TabsContent>)}
      </Tabs>

      <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground md:grid-cols-3">
        <div className="flex gap-2"><Users className="mt-0.5 size-4 shrink-0 text-primary" /><span>{selectedExperiments.length || "No"} validation experiment{selectedExperiments.length === 1 ? "" : "s"} provide historical success criteria.</span></div>
        <div className="flex gap-2"><MessageSquare className="mt-0.5 size-4 shrink-0 text-primary" /><span>{selectedFeedback.length || "No"} linked feedback item{selectedFeedback.length === 1 ? "" : "s"} are available for this Product Idea.</span></div>
        <div className="flex gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0 text-primary" /><span>{selectedSignals.length || "No"} discovery signal{selectedSignals.length === 1 ? "" : "s"} and {selectedHypotheses.length || "no"} assumption{selectedHypotheses.length === 1 ? "" : "s"} remain historical context.</span></div>
      </div>

      <Dialog open={Boolean(viewAllGroup)} onOpenChange={(open) => !open && setViewAllGroup(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewAllGroup?.title} ({viewAllGroup?.metrics.length})</DialogTitle>
            <DialogDescription>Full metric definition list for this V1 category. Values shown are representative demo data.</DialogDescription>
          </DialogHeader>
          <div className="divide-y rounded-md border px-3">
            {viewAllGroup?.metrics.map((currentMetric) => <MetricRow key={currentMetric.id} currentMetric={currentMetric} />)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}