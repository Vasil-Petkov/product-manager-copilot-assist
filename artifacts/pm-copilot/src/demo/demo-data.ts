export const createdAt = "2026-02-12T09:00:00.000Z";
export const updatedAt = "2026-02-18T14:30:00.000Z";

export const demoUser = {
  id: "demo-user",
  email: "demo@example.invalid",
  firstName: "Demo",
  lastName: "PM",
  profileImageUrl: null,
};

export const demoOpportunities = [
  {
    id: 101,
    title: "Turn scattered customer feedback into a weekly signal digest",
    description:
      "PMs spend too much time collecting feedback across support, sales, and research tools before they can see the common pattern.",
    category: "Product operations",
    sourceType: "customer_feedback",
    aiSummary:
      "A recurring need for a single, prioritized view of customer signals with enough context to decide what to do next.",
    customerProblem:
      "Important feedback is distributed across tools and often reaches product teams without enough context.",
    suggestedSolution:
      "Create a weekly signal digest that groups related requests, quotes the source, and highlights movement over time.",
    businessValue: "Faster, more evidence-based product decisions.",
    estimatedCustomerImpact: "High — saves each PM several hours per week.",
    estimatedBusinessImpact: "Medium — improves retention of high-value feedback.",
    urgency: "high",
    confidenceScore: 0.94,
    sentiment: "negative",
    tags: ["feedback", "insights", "workflow"],
    status: "ready_for_prioritization",
    createdAt,
    updatedAt,
  },
  {
    id: 102,
    title: "Give teams a shared view of roadmap dependencies",
    description:
      "Cross-functional teams need to see which commitments are blocked, at risk, or waiting on another initiative.",
    category: "Planning",
    sourceType: "stakeholder",
    aiSummary: "Dependency visibility is the highest-leverage improvement for roadmap confidence.",
    customerProblem: "Teams discover dependencies late, after dates have already slipped.",
    suggestedSolution: "Add dependency relationships and an at-risk view to roadmap planning.",
    businessValue: "Fewer missed commitments and clearer trade-offs.",
    estimatedCustomerImpact: "Medium",
    estimatedBusinessImpact: "High",
    urgency: "high",
    confidenceScore: 0.88,
    sentiment: "neutral",
    tags: ["roadmap", "dependencies"],
    status: "under_review",
    createdAt,
    updatedAt,
  },
  {
    id: 103,
    title: "Help new customers reach their first meaningful outcome",
    description:
      "New accounts understand the product but do not always reach the first value moment during their first week.",
    category: "Activation",
    sourceType: "meeting",
    aiSummary: "A guided first-week plan could reduce time to value without adding implementation work.",
    customerProblem: "New users do not know which workflow to complete first.",
    suggestedSolution: "Offer a role-aware activation checklist with progress and examples.",
    businessValue: "Higher activation and stronger early retention.",
    estimatedCustomerImpact: "High",
    estimatedBusinessImpact: "High",
    urgency: "medium",
    confidenceScore: 0.81,
    sentiment: "negative",
    tags: ["activation", "onboarding"],
    status: "new",
    createdAt,
    updatedAt,
  },
  {
    id: 104,
    title: "Show why an AI recommendation was made",
    description:
      "Teams want to use AI recommendations confidently but need to understand which evidence influenced the result.",
    category: "Trust",
    sourceType: "idea_portal",
    aiSummary: "Evidence-linked explanations could improve adoption of AI-assisted decisions.",
    customerProblem: "Recommendations feel like a black box when the supporting evidence is not visible.",
    suggestedSolution: "Show the evidence, assumptions, and confidence behind every recommendation.",
    businessValue: "More trusted AI-assisted workflows.",
    estimatedCustomerImpact: "Medium",
    estimatedBusinessImpact: "High",
    urgency: "medium",
    confidenceScore: 0.79,
    sentiment: "neutral",
    tags: ["ai", "trust", "explainability"],
    status: "new",
    createdAt,
    updatedAt,
  },
];

export const demoSignals = [
  { id: 201, content: "We copy customer quotes into three different documents every Monday.", sourceType: "stakeholder", sourcePlatform: "Slack", author: "Maya Chen", sentiment: "negative", processed: true, opportunityId: 101, createdAt },
  { id: 202, content: "I want to know which roadmap items are waiting on the platform team.", sourceType: "idea_portal", sourcePlatform: "Canny", author: "Customer 184", sentiment: "neutral", processed: true, opportunityId: 102, createdAt },
  { id: 203, content: "It took our team two weeks to figure out the workflow that mattered for our role.", sourceType: "meeting", sourcePlatform: "Gong", author: "Northstar Labs", sentiment: "negative", processed: true, opportunityId: 103, createdAt },
  { id: 204, content: "The ranking is useful, but I need to see what drove the score.", sourceType: "social_media", sourcePlatform: "LinkedIn", author: "Jordan Lee", sentiment: "neutral", processed: true, opportunityId: 104, createdAt },
  { id: 205, content: "A digest with the top three themes would make our planning meeting much faster.", sourceType: "stakeholder", sourcePlatform: "Email", author: "Ravi Patel", sentiment: "positive", processed: false, opportunityId: 101, createdAt },
];

export const demoCompetitors = [
  { id: 301, name: "SignalStack", website: "https://signalstack.example", description: "A customer feedback aggregation tool focused on support teams.", industry: "Customer intelligence", notes: "Strong in ingestion, weaker in product decision workflows.", lastAnalyzedAt: updatedAt, latestAnalysis: "Recently launched sentiment clustering. No roadmap or prioritization workflow observed.", threatLevel: "medium", createdAt, updatedAt },
  { id: 302, name: "Planwise", website: "https://planwise.example", description: "A collaborative roadmap planning workspace.", industry: "Product planning", notes: "Good planning views, limited discovery evidence.", lastAnalyzedAt: updatedAt, latestAnalysis: "Expanded dependency visualization and enterprise permissions.", threatLevel: "high", createdAt, updatedAt },
  { id: 303, name: "InsightPilot", website: "https://insightpilot.example", description: "An AI assistant for analyzing product research.", industry: "AI research", notes: "Strong summaries, no end-to-end lifecycle.", lastAnalyzedAt: createdAt, latestAnalysis: "Positioning emphasizes research synthesis and quick summaries.", threatLevel: "low", createdAt, updatedAt },
];

export const demoMeetings = [
  { id: 401, title: "Northstar quarterly product review", meetingDate: "2026-02-17", attendees: ["Maya Chen", "Alex Morgan", "Northstar Labs"], transcript: "Customers need a faster way to connect feedback with roadmap decisions.", notes: "Follow up on signal digest and dependency visibility.", analyzed: true, opportunitiesExtracted: 2, createdAt, updatedAt },
  { id: 402, title: "Activation research readout", meetingDate: "2026-02-14", attendees: ["Ravi Patel", "Growth team"], transcript: "The first value moment is unclear for new workspace owners.", notes: "Test a role-based first-week checklist.", analyzed: true, opportunitiesExtracted: 1, createdAt, updatedAt },
  { id: 403, title: "AI trust interviews", meetingDate: "2026-02-11", attendees: ["Jordan Lee", "Design team"], transcript: "People want recommendations but need to inspect the evidence.", notes: "Explore evidence-linked explanations.", analyzed: false, opportunitiesExtracted: 0, createdAt, updatedAt },
];

export const demoFeedback = [
  { id: 501, department: "customer_success", stakeholderName: "Maya Chen", description: "Customers ask for a repeatable way to turn calls into product priorities.", customerImpact: "Teams lose confidence that important requests will be acted on.", businessContext: "Renewal conversations depend on visible follow-through.", urgency: "high", opportunityId: 101, createdAt, updatedAt },
  { id: 502, department: "engineering", stakeholderName: "Alex Morgan", description: "Dependencies are discovered during delivery instead of during planning.", customerImpact: "Dates move without a clear explanation.", businessContext: "Platform work is shared by three roadmap initiatives.", urgency: "high", opportunityId: 102, createdAt, updatedAt },
  { id: 503, department: "marketing", stakeholderName: "Ravi Patel", description: "New users need a simpler story for what to do in their first week.", customerImpact: "Activation stalls before the first value moment.", businessContext: "Onboarding completion correlates with expansion.", urgency: "medium", opportunityId: 103, createdAt, updatedAt },
];

const productIdea = (opportunity: (typeof demoOpportunities)[number]) => ({
  id: opportunity.id,
  title: opportunity.title,
  description: opportunity.description,
  problemStatement: opportunity.customerProblem,
  customerProblem: opportunity.customerProblem,
  suggestedSolution: opportunity.suggestedSolution,
  businessValue: opportunity.businessValue,
  customerValue: opportunity.estimatedCustomerImpact,
  estimatedCustomerImpact: opportunity.estimatedCustomerImpact,
  estimatedBusinessImpact: opportunity.estimatedBusinessImpact,
  urgency: opportunity.urgency,
  confidenceScore: opportunity.confidenceScore,
  status: opportunity.status,
  relatedFeedbackCount: demoFeedback.filter((item) => item.opportunityId === opportunity.id).length,
  relatedSignalCount: demoSignals.filter((item) => item.opportunityId === opportunity.id).length,
  prioritization: {
    analysisAvailable: true,
    riceScore: 42 + opportunity.id % 10,
    iceScore: 7.1,
    moscowCategory: opportunity.id === 101 || opportunity.id === 102 ? "must_have" : "should_have",
    weightedScore: 82,
    overallPriority: opportunity.id === 101 ? 1 : 2,
    businessValue: opportunity.businessValue,
    customerImpact: opportunity.estimatedCustomerImpact,
    engineeringEffort: 4,
  },
});

export const demoMethods = [
  { key: "customer_interview", name: "Customer interviews", category: "generative", summary: "Talk with representative customers to learn how they work today.", bestFor: "Understanding problems and motivations", effort: "Medium", evidenceStrength: "Medium", defaultDurationDays: 10 },
  { key: "prototype_test", name: "Prototype usability test", category: "evaluative", summary: "Observe target users completing a focused prototype workflow.", bestFor: "Testing usability and comprehension", effort: "Medium", evidenceStrength: "High", defaultDurationDays: 7 },
  { key: "fake_door", name: "Fake-door experiment", category: "smoke_test", summary: "Measure interest in a concept before building the full experience.", bestFor: "Testing demand and messaging", effort: "Low", evidenceStrength: "Medium", defaultDurationDays: 5 },
  { key: "cohort_analysis", name: "Cohort analysis", category: "quantitative", summary: "Compare behavior and outcomes across meaningful user cohorts.", bestFor: "Measuring adoption and retention", effort: "High", evidenceStrength: "High", defaultDurationDays: 14 },
];

const validationContext = (opportunity: (typeof demoOpportunities)[number]) => productIdea(opportunity).prioritization;

export const demoHypotheses = [
  { id: 601, opportunityId: 101, hypothesisType: "problem", statement: "If PMs receive a weekly evidence digest, they will spend less time manually collecting customer signals.", assumption: "The current collection work is a meaningful time cost.", successCriteria: "At least 60% of pilot PMs report saving two hours per week.", status: "in_validation", notes: "Pilot with five product teams.", aiSuggestion: "Measure time-to-insight before and after the digest.", archivedAt: null, createdAt, updatedAt, productIdea: productIdea(demoOpportunities[0]), prioritization: validationContext(demoOpportunities[0]) },
  { id: 602, opportunityId: 103, hypothesisType: "value", statement: "If new users see a role-based first-week checklist, activation completion will increase.", assumption: "The issue is direction rather than product capability.", successCriteria: "First-week activation increases by 15% without reducing qualified setup.", status: "ready_for_validation", notes: "Compare against the current onboarding experience.", aiSuggestion: "Segment the result by workspace role.", archivedAt: null, createdAt, updatedAt, productIdea: productIdea(demoOpportunities[2]), prioritization: validationContext(demoOpportunities[2]) },
  { id: 603, opportunityId: 104, hypothesisType: "solution", statement: "If each AI recommendation shows its supporting evidence, PMs will use AI-assisted prioritization more often.", assumption: "Trust is the main barrier to repeated usage.", successCriteria: "Recommendation follow-through increases by 20% in the pilot.", status: "validated", notes: "Interview evidence supports the trust barrier.", aiSuggestion: "Track evidence-panel opens and recommendation acceptance.", archivedAt: null, createdAt, updatedAt, productIdea: productIdea(demoOpportunities[3]), prioritization: validationContext(demoOpportunities[3]) },
];

export const demoExperiments = [
  { id: 701, hypothesisId: 601, name: "Signal digest pilot", methodKey: "customer_interview", method: demoMethods[0], setup: "Send a Friday digest to five PMs for three weeks.", targetAudience: "Product managers at mid-market SaaS companies", successMeasures: "Reported time saved and digest usefulness", actualResult: null, outcome: null, pmDecision: null, pmNotes: null, resultEnteredAt: null, status: "running", owner: { id: "demo-owner", name: "Demo PM", email: null }, plannedStartDate: "2026-02-20", plannedEndDate: "2026-03-13", startedAt: "2026-02-20", completedAt: null, archivedAt: null, createdAt, updatedAt, hypothesis: demoHypotheses[0] },
  { id: 702, hypothesisId: 602, name: "Activation checklist prototype", methodKey: "prototype_test", method: demoMethods[1], setup: "Test a role-aware checklist with eight new workspace owners.", targetAudience: "New workspace owners", successMeasures: "Checklist completion and time to first value", actualResult: "6 of 8 participants completed the intended first workflow.", outcome: "validated", pmDecision: "proceed", pmNotes: "Move to a limited rollout.", resultEnteredAt: updatedAt, status: "completed", owner: { id: "demo-owner", name: "Demo PM", email: null }, plannedStartDate: "2026-02-03", plannedEndDate: "2026-02-12", startedAt: "2026-02-03", completedAt: "2026-02-12", archivedAt: null, createdAt, updatedAt, hypothesis: demoHypotheses[1] },
];

export const demoPrioritization = demoOpportunities.map((opportunity, index) => ({
  opportunity,
  riceScore: { reach: 8 - index, impact: 3, confidence: 0.8, effort: 4 + index, score: 48 - index * 6 },
  iceScore: { impact: 8 - index, confidence: 7, ease: 6 - index % 3, score: 42 - index * 4 },
  moscowCategory: index < 2 ? "must_have" : "should_have",
  kanoCategory: index === 2 ? "performance" : "excitement",
  weightedScore: 86 - index * 8,
  opportunityScore: 8.4 - index * 0.7,
  vveQuadrant: index < 2 ? "quick_win" : "strategic_bet",
  aiRecommendation: index === 0 ? "Prioritize now: strong evidence, high customer impact, and manageable delivery effort." : "Sequence after the signal digest foundation is in place.",
  analyzed: true,
  overallRank: index + 1,
}));

export const demoRoadmap = {
  initiatives: [
    { id: 801, name: "Evidence-led product decisions", description: "Make customer evidence easy to find, understand, and connect to action.", createdAt, updatedAt },
    { id: 802, name: "Activation and adoption", description: "Help new teams reach value quickly and measure the outcome.", createdAt, updatedAt },
  ],
  items: [
    { id: 811, initiativeId: 801, opportunityId: 101, startDate: "2026-02-01", endDate: "2026-03-20", status: "in_progress", progress: 65, notes: "Pilot digest and evidence grouping.", createdAt, updatedAt, productIdea: { id: 101, title: demoOpportunities[0].title, description: demoOpportunities[0].description, category: demoOpportunities[0].category, status: demoOpportunities[0].status, urgency: demoOpportunities[0].urgency, confidenceScore: demoOpportunities[0].confidenceScore, riceScore: 48 } },
    { id: 812, initiativeId: 801, opportunityId: 102, startDate: "2026-03-16", endDate: "2026-04-17", status: "planned", progress: 15, notes: "Align with platform planning.", createdAt, updatedAt, productIdea: { id: 102, title: demoOpportunities[1].title, description: demoOpportunities[1].description, category: demoOpportunities[1].category, status: demoOpportunities[1].status, urgency: demoOpportunities[1].urgency, confidenceScore: demoOpportunities[1].confidenceScore, riceScore: 42 } },
    { id: 813, initiativeId: 802, opportunityId: 103, startDate: "2026-02-23", endDate: "2026-03-13", status: "at_risk", progress: 35, notes: "Waiting for onboarding analytics segment.", createdAt, updatedAt, productIdea: { id: 103, title: demoOpportunities[2].title, description: demoOpportunities[2].description, category: demoOpportunities[2].category, status: demoOpportunities[2].status, urgency: demoOpportunities[2].urgency, confidenceScore: demoOpportunities[2].confidenceScore, riceScore: 38 } },
  ],
  milestones: [
    { id: 821, initiativeId: 801, name: "Signal digest pilot review", date: "2026-03-20", description: "Decide whether to expand the digest pilot.", createdAt, updatedAt },
    { id: 822, initiativeId: 802, name: "Activation experiment readout", date: "2026-03-13", description: "Review first-week activation results.", createdAt, updatedAt },
  ],
};

export const demoDocuments = [
  {
    id: 901,
    productIdeaId: 101,
    userId: "demo-user",
    documentType: "prd",
    status: "accepted",
    title: "PRD — Customer Signal Digest",
    content: "# Customer Signal Digest\n\n## Problem\nPMs spend too much time collecting customer evidence manually.\n\n## Goal\nHelp product teams identify the strongest themes and decide what to do next.\n\n## Success metrics\n- Reduce weekly signal synthesis time by 50%\n- Increase evidence-linked decisions in pilot teams\n\n## Scope\n- Group related signals\n- Show representative quotes\n- Provide a weekly summary with confidence\n\n## Open questions\n- Which sources should be included in the first pilot?",
    generationMetadata: { promptVersion: "demo-fixture-v1", model: "deterministic-demo", generatedAt: updatedAt, contextSummary: "Fictional customer signal digest context" },
    humanEdited: true,
    revision: 2,
    acceptedAt: updatedAt,
    acceptedBy: "demo-user",
    createdAt,
    updatedAt,
  },
];

export const demoInsights = [
  { id: 1001, type: "trending_problem", title: "Evidence is scattered across teams", content: "Four signals and two stakeholder notes point to repeated manual collection work.", relatedOpportunityIds: [101], confidence: 0.92, createdAt },
  { id: 1002, type: "emerging_request", title: "Teams want roadmap confidence", content: "Dependency visibility is becoming a repeated request from engineering and customer success.", relatedOpportunityIds: [102], confidence: 0.84, createdAt },
];

export const demoContext = {
  productIdeaId: 101,
  documentType: "prd",
  requiredSections: ["Problem", "Goals", "Success metrics", "Scope", "Open questions"],
  productIdea: {
    title: demoOpportunities[0].title,
    description: demoOpportunities[0].description,
    category: demoOpportunities[0].category,
    sourceType: demoOpportunities[0].sourceType,
    status: demoOpportunities[0].status,
    problemStatement: demoOpportunities[0].customerProblem,
    rootCause: "Feedback is captured in disconnected workflows.",
    customerProblem: demoOpportunities[0].customerProblem,
    suggestedSolution: demoOpportunities[0].suggestedSolution,
    businessValue: demoOpportunities[0].businessValue,
    customerValue: demoOpportunities[0].estimatedCustomerImpact,
    estimatedCustomerImpact: demoOpportunities[0].estimatedCustomerImpact,
    estimatedBusinessImpact: demoOpportunities[0].estimatedBusinessImpact,
    dependencies: "Source connectors and a weekly digest schedule.",
    openQuestions: ["Which source connectors are required for the pilot?"],
    aiSummary: demoOpportunities[0].aiSummary,
    aiRecommendation: "Run a small pilot before broad rollout.",
  },
  evidenceSummary: { signalsCount: 5, stakeholderFeedbackCount: 3, linkedMeetingsCount: 1, linkedCompetitorsCount: 0 },
};

export function createDemoState() {
  return {
    opportunities: structuredClone(demoOpportunities),
    signals: structuredClone(demoSignals),
    competitors: structuredClone(demoCompetitors),
    meetings: structuredClone(demoMeetings),
    feedback: structuredClone(demoFeedback),
    prioritization: structuredClone(demoPrioritization),
    hypotheses: structuredClone(demoHypotheses),
    experiments: structuredClone(demoExperiments),
    roadmap: structuredClone(demoRoadmap),
    documents: structuredClone(demoDocuments),
    insights: structuredClone(demoInsights),
  };
}