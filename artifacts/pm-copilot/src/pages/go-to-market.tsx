import { useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  BriefcaseBusiness,
  CalendarRange,
  CheckCircle2,
  CircleDot,
  Compass,
  DollarSign,
  Flag,
  Megaphone,
  Network,
  Plus,
  Rocket,
  Sparkles,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import {
  useGetRoadmap,
  useListCompetitors,
  useListFeedback,
  useListMeetings,
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
import { Textarea } from "@/components/ui/textarea";

const acquisitionChannels = ["Content", "SEO", "Paid search", "Community", "Partners", "Events"];
const salesChannels = ["Self-serve", "Sales-assisted", "Direct sales", "Partner sales", "Customer success"];
const launchPhases = [
  ["Pre-launch", "Confirm positioning, prepare enablement, and align internal teams."],
  ["Launch", "Coordinate release communications, channels, and launch ownership."],
  ["Post-launch", "Capture early feedback and prepare an outcome review."],
];
const okrMeasurements = [
  "MRR",
  "ARR",
  "ARPU",
  "CLV/LTV",
  "CAC",
  "Conversion Rate",
  "Churn Rate",
  "NPS",
  "CSAT",
  "DAU",
  "MAU",
  "Feature Adoption Rate",
  "Activation Rate",
  "Retention",
  "Task Success Rate",
];

type ActivityDraft = {
  activity: string;
  channel: string;
  audience: string;
  owner: string;
  timing: string;
};

type KeyResultDraft = {
  id: number;
  title: string;
  target: string;
  measurement: string;
  timeframe: string;
  status: string;
};

const emptyKeyResult = (id: number): KeyResultDraft => ({
  id,
  title: "",
  target: "",
  measurement: "",
  timeframe: "",
  status: "Not started",
});

function SourceBadge({ children }: { children: string }) {
  return (
    <Badge variant="secondary" className="text-[10px] font-medium uppercase tracking-wide">
      From {children}
    </Badge>
  );
}

function NotDefined({ message = "Not defined yet" }: { message?: string }) {
  return (
    <p className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
      {message}
    </p>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  source,
  children,
}: {
  icon: typeof Target;
  title: string;
  description: string;
  source?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="h-full shadow-sm">
      <CardHeader className="space-y-2 border-b bg-muted/5 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Icon className="size-5 text-primary" />
          <CardTitle className="text-lg">{title}</CardTitle>
          {source && <SourceBadge>{source}</SourceBadge>}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">{children}</CardContent>
    </Card>
  );
}

function SelectablePill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <Button
      type="button"
      variant={selected ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className="h-8"
    >
      {children}
    </Button>
  );
}

export default function GoToMarket() {
  const [selectedId, setSelectedId] = useState("");
  const [pricingModel, setPricingModel] = useState("");
  const [pricingNotes, setPricingNotes] = useState("");
  const [motion, setMotion] = useState("");
  const [acquisition, setAcquisition] = useState<string[]>([]);
  const [sales, setSales] = useState<string[]>([]);
  const [activity, setActivity] = useState<ActivityDraft>({
    activity: "",
    channel: "",
    audience: "",
    owner: "",
    timing: "",
  });
  const [objectiveTitle, setObjectiveTitle] = useState("");
  const [objectiveDescription, setObjectiveDescription] = useState("");
  const [keyResults, setKeyResults] = useState<KeyResultDraft[]>([emptyKeyResult(1)]);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  const { data: opportunities = [] } = useListOpportunities({});
  const { data: competitors = [] } = useListCompetitors({});
  const { data: signals = [] } = useListSignals({});
  const { data: feedback = [] } = useListFeedback({});
  const { data: meetings = [] } = useListMeetings({});
  const { data: prioritization = [] } = useListPrioritization({});
  const { data: hypotheses = [] } = useListValidationHypotheses({});
  const { data: experiments = [] } = useListValidationExperiments({});
  const { data: roadmap } = useGetRoadmap();

  const selectedOpportunityId = selectedId ? Number(selectedId) : undefined;
  const opportunity = opportunities.find((item) => item.id === selectedOpportunityId);
  const opportunitySignals = signals.filter((item) => item.opportunityId === selectedOpportunityId);
  const opportunityFeedback = feedback.filter((item) => item.opportunityId === selectedOpportunityId);
  const opportunityHypotheses = hypotheses.filter((item) => item.opportunityId === selectedOpportunityId);
  const opportunityExperiments = experiments.filter((item) =>
    opportunityHypotheses.some((hypothesis) => hypothesis.id === item.hypothesisId),
  );
  const opportunityPrioritization = prioritization.find(
    (item) => item.opportunity?.id === selectedOpportunityId,
  );
  const roadmapItems = roadmap?.items.filter((item) => item.opportunityId === selectedOpportunityId) ?? [];
  const relevantInitiativeIds = new Set(roadmapItems.map((item) => item.initiativeId));
  const roadmapMilestones = roadmap?.milestones.filter((item) => relevantInitiativeIds.has(item.initiativeId)) ?? [];

  const targetAudiences = useMemo(
    () =>
      Array.from(
        new Set(
          opportunityExperiments
            .map((experiment) => experiment.targetAudience)
            .filter((audience): audience is string => Boolean(audience)),
        ),
      ),
    [opportunityExperiments],
  );

  const toggle = (value: string, setValues: React.Dispatch<React.SetStateAction<string[]>>) => {
    setValues((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  };

  const updateKeyResult = (id: number, field: keyof Omit<KeyResultDraft, "id">, value: string) => {
    setKeyResults((current) =>
      current.map((keyResult) => (keyResult.id === id ? { ...keyResult, [field]: value } : keyResult)),
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 p-6 md:p-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Rocket className="size-8 text-primary" />
            Go To Market
          </h1>
          <Badge variant="secondary">V1 foundation</Badge>
        </div>
        <p className="max-w-3xl text-muted-foreground">
          Turn validated customer problems, market context, priorities, and delivery timing into a
          clear launch strategy. Existing workspace information is shown as read-only source context.
        </p>
      </header>

      <Card className="border-primary/20 bg-primary/[0.025]">
        <CardContent className="grid gap-4 p-4 md:grid-cols-[minmax(0,420px)_1fr] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="gtm-product-idea">Product Idea</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger id="gtm-product-idea" className="bg-background">
                <SelectValue placeholder="Select a Product Idea" />
              </SelectTrigger>
              <SelectContent>
                {opportunities.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            This selection scopes inherited context for the strategy. It does not create a duplicate
            Product Idea or change its source records.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section
          icon={Users}
          title="Target Market & Customer"
          description="Customer problem, audience evidence, feedback, and discovery signals."
          source="Discovery & Validation"
        >
          {opportunity ? (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer problem</p>
                <p className="mt-1 text-sm">{opportunity.customerProblem || "Not defined yet"}</p>
              </div>
              {targetAudiences.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {targetAudiences.map((audience) => <Badge key={audience}>{audience}</Badge>)}
                </div>
              ) : (
                <NotDefined message="Target audience not defined in Validation yet" />
              )}
              <p className="text-sm text-muted-foreground">
                ICP, segment, and buyer/user roles: Not defined yet
              </p>
              <p className="text-sm text-muted-foreground">
                {opportunitySignals.length} linked signals · {opportunityFeedback.length} linked feedback items ·{" "}
                {meetings.length} meetings available in the workspace
              </p>
            </div>
          ) : (
            <NotDefined message="Select a Product Idea to view customer context" />
          )}
        </Section>

        <Section
          icon={BriefcaseBusiness}
          title="Market & Competitive Analysis"
          description="Competitive framing and market evidence collected by the workspace."
          source="Competitors & Feedback"
        >
          {competitors.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2">
                {competitors.slice(0, 8).map((competitor) => (
                  <Badge key={competitor.id} variant="outline">{competitor.name}</Badge>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {competitors.length} competitors tracked. Their detailed analysis remains in Discovery.
              </p>
            </>
          ) : (
            <NotDefined message="No competitors defined yet" />
          )}
          <div className="space-y-1 rounded-md bg-muted/20 p-3 text-sm text-muted-foreground">
            <p>Differentiation claim: Not defined yet</p>
            <p>Market gaps: Not defined yet</p>
            <p>Win themes: Not defined yet</p>
          </div>
        </Section>

        <Section
          icon={Megaphone}
          title="Positioning & Value Proposition"
          description="Read-only product narrative derived from the selected Product Idea."
          source="Product Ideas"
        >
          {opportunity ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Suggested solution</p>
                <p className="mt-1 text-sm">{opportunity.suggestedSolution || "Not defined yet"}</p>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Business value</p>
                <p className="mt-1 text-sm">{opportunity.businessValue || "Not defined yet"}</p>
              </div>
              <div className="rounded-md border bg-muted/20 p-3 sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Why choose us</p>
                <p className="mt-1 text-sm">Not defined yet</p>
              </div>
            </div>
          ) : (
            <NotDefined message="Select a Product Idea to view positioning context" />
          )}
        </Section>

        <Section
          icon={DollarSign}
          title="Pricing & Packaging"
          description="A lightweight PM decision for the initial GTM strategy."
        >
          <Badge variant="outline">PM decision · this session</Badge>
          <div className="space-y-2">
            <Label>Pricing model</Label>
            <Select value={pricingModel} onValueChange={setPricingModel}>
              <SelectTrigger><SelectValue placeholder="Not defined yet" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="subscription">Subscription</SelectItem>
                <SelectItem value="usage-based">Usage-based</SelectItem>
                <SelectItem value="per-seat">Per seat</SelectItem>
                <SelectItem value="transactional">Transactional</SelectItem>
                <SelectItem value="one-time">One-time</SelectItem>
                <SelectItem value="freemium">Freemium</SelectItem>
                <SelectItem value="enterprise-custom">Enterprise / custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={pricingNotes}
            onChange={(event) => setPricingNotes(event.target.value)}
            placeholder="Packaging, access, or commercial considerations"
          />
          <p className="text-sm text-muted-foreground">
            Packages, pricing logic, and constraints: Not defined yet
          </p>
        </Section>

        <Section
          icon={Compass}
          title="GTM Motion"
          description="Choose the primary motion to guide launch choices."
        >
          <Badge variant="outline">PM decision · this session</Badge>
          <Select value={motion} onValueChange={setMotion}>
            <SelectTrigger><SelectValue placeholder="Not defined yet" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="product-led">Product-led</SelectItem>
              <SelectItem value="sales-led">Sales-led</SelectItem>
              <SelectItem value="marketing-led">Marketing-led</SelectItem>
              <SelectItem value="partner-led">Partner-led</SelectItem>
              <SelectItem value="community-led">Community-led</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            The selected motion should shape channel prioritization, launch ownership, and the future AI recommendation.
          </p>
        </Section>

        <Section
          icon={Network}
          title="Channels & Distribution"
          description="Separate acquisition channels from sales channels."
        >
          <Badge variant="outline">PM decision · this session</Badge>
          <div className="space-y-2">
            <Label>Acquisition channels</Label>
            <div className="flex flex-wrap gap-2">
              {acquisitionChannels.map((channel) => (
                <SelectablePill
                  key={channel}
                  selected={acquisition.includes(channel)}
                  onClick={() => toggle(channel, setAcquisition)}
                >
                  {channel}
                </SelectablePill>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Sales channels</Label>
            <div className="flex flex-wrap gap-2">
              {salesChannels.map((channel) => (
                <SelectablePill
                  key={channel}
                  selected={sales.includes(channel)}
                  onClick={() => toggle(channel, setSales)}
                >
                  {channel}
                </SelectablePill>
              ))}
            </div>
          </div>
        </Section>

        <Section
          icon={Target}
          title="Sales & Marketing Plan"
          description="A lightweight activity structure for the initial plan."
        >
          <Badge variant="outline">PM decision · this session</Badge>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["activity", "channel", "audience", "owner", "timing"] as const).map((field) => (
              <div key={field} className={field === "activity" ? "sm:col-span-2" : ""}>
                <Label className="capitalize">{field}</Label>
                <Input
                  value={activity[field]}
                  onChange={(event) => setActivity((current) => ({ ...current, [field]: event.target.value }))}
                  placeholder={`Not defined yet`}
                />
              </div>
            ))}
          </div>
        </Section>

        <Section
          icon={Flag}
          title="Launch Plan"
          description="Simple launch phases supplemented by Roadmap delivery timing."
          source="Roadmap"
        >
          <div className="space-y-3">
            {launchPhases.map(([phase, detail]) => (
              <div key={phase} className="flex gap-3 rounded-md border bg-muted/10 p-3">
                <CircleDot className="mt-0.5 size-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">{phase}</p>
                  <p className="text-sm text-muted-foreground">{detail}</p>
                </div>
              </div>
            ))}
          </div>
          {roadmapItems.length > 0 ? (
            <div className="space-y-2">
              {roadmapItems.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <CalendarRange className="size-4 text-primary" />
                  <span>{item.startDate || "Start TBD"} — {item.endDate || "Delivery TBD"}</span>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
              ))}
              {roadmapMilestones.map((milestone) => (
                <p key={milestone.id} className="text-sm text-muted-foreground">
                  Milestone: {milestone.name} · {milestone.date}
                </p>
              ))}
            </div>
          ) : (
            <NotDefined message="Roadmap delivery timing not defined yet" />
          )}
        </Section>

        <Section
          icon={BarChart3}
          title="Goals, KPIs & Risks"
          description="Connect measurable launch outcomes to existing validation and prioritization."
          source="Prioritization & Validation"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">RICE score</p>
              <p className="mt-1 text-lg font-semibold">{opportunityPrioritization?.riceScore?.score ?? "Not defined yet"}</p>
            </div>
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Validation experiments</p>
              <p className="mt-1 text-lg font-semibold">{opportunityExperiments.length || "Not defined yet"}</p>
            </div>
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Risks</p>
              <p className="mt-1 text-lg font-semibold">{opportunityHypotheses.length ? "Review assumptions" : "Not defined yet"}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Launch goal and target KPIs: Not defined yet
          </p>
          {opportunityExperiments.length > 0 && (
            <div className="space-y-2">
              {opportunityExperiments.map((experiment) => (
                <p key={experiment.id} className="text-sm text-muted-foreground">
                  KPI input: {experiment.successMeasures || experiment.name}
                </p>
              ))}
            </div>
          )}
          <div className="space-y-4 border-t pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold">OKRs</h3>
                <p className="text-sm text-muted-foreground">
                  Define the intended outcomes for this launch.
                </p>
              </div>
              <Badge variant="outline">PM decision · this session</Badge>
            </div>

            {opportunity && (
              <div className="rounded-md border bg-muted/20 p-3 text-sm">
                <span className="font-medium">Product Idea context: </span>
                {opportunity.title}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="gtm-okr-objective-title">Objective title</Label>
              <Input
                id="gtm-okr-objective-title"
                value={objectiveTitle}
                onChange={(event) => setObjectiveTitle(event.target.value)}
                placeholder={opportunity ? `Successfully launch ${opportunity.title}` : "Successfully launch a product outcome"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gtm-okr-objective-description">Objective description</Label>
              <Textarea
                id="gtm-okr-objective-description"
                value={objectiveDescription}
                onChange={(event) => setObjectiveDescription(event.target.value)}
                placeholder={opportunity?.businessValue || "Describe the outcome this launch should achieve"}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label>Key results</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setKeyResults((current) => [...current, emptyKeyResult(Date.now())])}
                >
                  <Plus className="size-4" />
                  Add key result
                </Button>
              </div>
              {keyResults.map((keyResult, index) => (
                <div key={keyResult.id} className="space-y-3 rounded-md border bg-muted/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Key Result {index + 1}</p>
                    {keyResults.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        aria-label={`Remove Key Result ${index + 1}`}
                        onClick={() => setKeyResults((current) => current.filter((item) => item.id !== keyResult.id))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`gtm-okr-key-result-title-${keyResult.id}`}>Key Result title</Label>
                    <Input
                      id={`gtm-okr-key-result-title-${keyResult.id}`}
                      value={keyResult.title}
                      onChange={(event) => updateKeyResult(keyResult.id, "title", event.target.value)}
                      placeholder="Reach 35% feature adoption"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`gtm-okr-target-${keyResult.id}`}>Target value</Label>
                      <Input
                        id={`gtm-okr-target-${keyResult.id}`}
                        value={keyResult.target}
                        onChange={(event) => updateKeyResult(keyResult.id, "target", event.target.value)}
                        placeholder="35%"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Measurement / KPI</Label>
                      <Select
                        value={keyResult.measurement}
                        onValueChange={(value) => updateKeyResult(keyResult.id, "measurement", value)}
                      >
                        <SelectTrigger><SelectValue placeholder="Select a KPI" /></SelectTrigger>
                        <SelectContent>
                          {okrMeasurements.map((measurement) => (
                            <SelectItem key={measurement} value={measurement}>{measurement}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`gtm-okr-timeframe-${keyResult.id}`}>Timeframe</Label>
                      <Input
                        id={`gtm-okr-timeframe-${keyResult.id}`}
                        value={keyResult.timeframe}
                        onChange={(event) => updateKeyResult(keyResult.id, "timeframe", event.target.value)}
                        placeholder="By end of Q3"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status / progress</Label>
                      <Select
                        value={keyResult.status}
                        onValueChange={(value) => updateKeyResult(keyResult.id, "status", value)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Not started">Not started</SelectItem>
                          <SelectItem value="In progress">In progress</SelectItem>
                          <SelectItem value="At risk">At risk</SelectItem>
                          <SelectItem value="Complete">Complete</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Live progress will be available in Post Launch Monitoring.</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-md border border-primary/20 bg-primary/[0.04] p-3 text-sm text-muted-foreground">
              These OKRs define the outcomes expected from the launch. Post Launch Monitoring will later use the associated KPIs to track actual performance against these Key Results.
            </div>
          </div>
        </Section>

        <Section
          icon={Sparkles}
          title="AI GTM Strategy"
          description="A review-first foundation for a future GTM synthesis workflow."
        >
          <div className="rounded-md border border-ai/20 bg-ai/[0.04] p-4">
            <p className="font-medium">Generate → Review → Accept / Edit / Reject → Apply</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The future AI strategy will use the visible workspace sources and PM decisions. It will not execute launch work automatically.
            </p>
          </div>
          <Button className="gap-2" onClick={() => setAiDialogOpen(true)}>
            <Sparkles className="size-4" />
            Generate GTM Strategy
          </Button>
        </Section>
      </div>

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI GTM Strategy foundation</DialogTitle>
            <DialogDescription>
              Strategy generation is intentionally not active in this V1 skeleton.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              When enabled, this action will synthesize Product Idea context, validation evidence,
              competitor information, prioritization, Roadmap timing, and the PM choices made above.
            </p>
            <div className="rounded-md bg-muted p-3">
              <p className="font-medium text-foreground">Review-first workflow</p>
              <p className="mt-1">Generate strategy → review it → accept, edit, or reject → apply approved parts manually.</p>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-primary" />
              <span>No marketing activity, campaign, pricing, or CRM action will run automatically.</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}