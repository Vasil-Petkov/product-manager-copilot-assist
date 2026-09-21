import {
  createDemoState,
  demoContext,
  demoMethods,
  demoUser,
  createdAt,
  updatedAt,
} from "./demo-data.ts";

type DemoState = ReturnType<typeof createDemoState>;

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });

const empty = () => new Response(null, { status: 204 });

const idFromPath = (path: string, marker: string) => {
  const match = path.match(new RegExp(`${marker}/(\\d+)`));
  return match ? Number(match[1]) : undefined;
};

async function requestBody(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.body && typeof init.body === "string") {
    try {
      return JSON.parse(init.body);
    } catch {
      return {};
    }
  }
  if (typeof Request !== "undefined" && input instanceof Request) {
    try {
      return await input.clone().json();
    } catch {
      return {};
    }
  }
  return {};
}

function buildOpportunityDetail(state: DemoState, id: number) {
  const opportunity = state.opportunities.find((item) => item.id === id) ?? state.opportunities[0];
  return {
    ...opportunity,
    evidence: {
      customerRequestCount: state.signals.filter((item) => item.opportunityId === opportunity.id).length,
      stakeholderMentions: state.feedback.filter((item) => item.opportunityId === opportunity.id).length,
      meetingMentions: state.meetings.filter((item) => item.id === 401 && opportunity.id === 101).length,
      competitorReferences: opportunity.id === 102 ? 2 : 0,
      socialMentions: 1,
      exampleQuotes: state.signals.filter((item) => item.opportunityId === opportunity.id).map((item) => item.content),
      sourceLinks: ["https://example.invalid/demo-source"],
    },
    relatedSignals: state.signals.filter((item) => item.opportunityId === opportunity.id),
  };
}

function validationProductIdeas(state: DemoState) {
  return state.opportunities.map((opportunity) => ({
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
    relatedFeedbackCount: state.feedback.filter((item) => item.opportunityId === opportunity.id).length,
    relatedSignalCount: state.signals.filter((item) => item.opportunityId === opportunity.id).length,
    prioritization: {
      analysisAvailable: true,
      riceScore: 48,
      iceScore: 42,
      moscowCategory: "must_have",
      weightedScore: 82,
      overallPriority: 1,
      businessValue: opportunity.businessValue,
      customerImpact: opportunity.estimatedCustomerImpact,
      engineeringEffort: 4,
    },
  }));
}

function findById<T extends { id: number }>(items: T[], path: string, marker: string) {
  const id = idFromPath(path, marker);
  return items.find((item) => item.id === id) ?? items[0];
}

export function installDemoApi() {
  const state = createDemoState();
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" || input instanceof URL ? new URL(input.toString(), window.location.origin) : new URL(input.url);
    if (!url.pathname.startsWith("/api/")) return originalFetch(input, init);

    const path = url.pathname;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const body = await requestBody(input, init);

    if (path === "/api/auth/user") return json({ user: demoUser });
    if (path === "/api/healthz") return json({ status: "ok" });
    if (path === "/api/dashboard/stats") {
      return json({
        totalOpportunities: state.opportunities.length,
        newOpportunities: state.opportunities.filter((item) => item.status === "new").length,
        waitingForPrioritization: state.opportunities.filter((item) => item.status === "ready_for_prioritization").length,
        totalSignals: state.signals.length,
        totalCompetitors: state.competitors.length,
        totalMeetings: state.meetings.length,
        topRequests: [{ label: "Customer signal digest", count: 18, trend: "up" }],
        topPainPoints: [{ label: "Scattered evidence", count: 12, trend: "up" }],
        topCompetitorChanges: [{ label: "Dependency views", count: 4, trend: "up" }],
        latestMeetingInsights: [{ label: "Activation clarity", count: 3, trend: "stable" }],
        sourceBreakdown: [{ sourceType: "stakeholder", count: 2 }, { sourceType: "meeting", count: 1 }, { sourceType: "idea_portal", count: 1 }],
        sentimentBreakdown: [{ sentiment: "negative", count: 3 }, { sentiment: "neutral", count: 2 }, { sentiment: "positive", count: 1 }],
      });
    }
    if (path === "/api/dashboard/daily-summary") {
      return json({
        summary: "The strongest opportunity this week is a customer signal digest. Evidence is consistent across stakeholder feedback, meetings, and idea portal requests. Roadmap dependency visibility is the next highest-leverage theme.",
        keyThemes: ["Evidence-led decisions", "Roadmap confidence", "Activation"],
        urgentItems: ["Signal digest pilot review is due this week."],
        recommendations: ["Run the digest pilot with five PMs.", "Align platform dependencies before the next roadmap review."],
        generatedAt: updatedAt,
      });
    }

    if (path === "/api/opportunities" && method === "GET") return json(state.opportunities);
    if (path === "/api/opportunities" && method !== "GET") {
      const created = { ...state.opportunities[0], ...body, id: 110 + state.opportunities.length, createdAt: updatedAt, updatedAt };
      state.opportunities.push(created);
      return json(created);
    }
    if (/^\/api\/opportunities\/\d+$/.test(path)) {
      const item = findById(state.opportunities, path, "/api/opportunities");
      if (method === "GET") return json(item);
      if (method === "DELETE") {
        state.opportunities = state.opportunities.filter((candidate) => candidate.id !== item.id);
        return empty();
      }
      Object.assign(item, body, { updatedAt });
      return json(item);
    }
    if (/^\/api\/opportunities\/\d+\/analyze$/.test(path)) {
      return json({ ...findById(state.opportunities, path, "/api/opportunities"), aiSummary: "Demo AI analysis: evidence is strong enough for a focused pilot.", confidenceScore: 0.91, updatedAt });
    }

    if (path === "/api/signals" && method === "GET") return json(state.signals);
    if (path === "/api/signals" && method !== "GET") {
      const created = { id: 220 + state.signals.length, ...body, processed: true, createdAt: updatedAt };
      state.signals.push(created);
      return json({ signal: created, opportunity: state.opportunities[0] });
    }
    if (path === "/api/signals/bulk") return json({ imported: body.signals?.length ?? 0, opportunitiesCreated: 0, signals: [] });
    if (/^\/api\/signals\/\d+$/.test(path)) {
      if (method === "DELETE") return empty();
      return json(findById(state.signals, path, "/api/signals"));
    }

    if (path === "/api/competitors" && method === "GET") return json(state.competitors);
    if (path === "/api/competitors" && method !== "GET") {
      const created = { id: 330 + state.competitors.length, ...body, createdAt: updatedAt, updatedAt };
      state.competitors.push(created);
      return json(created);
    }
    if (/^\/api\/competitors\/\d+\/reports$/.test(path)) return json([{ id: 350, competitorId: idFromPath(path, "/api/competitors") ?? 301, summary: "Demo analysis: competitor activity is concentrated in planning visibility.", newFeatures: ["Dependency map"], pricingChanges: null, businessImpact: "Medium", possibleThreat: "Faster enterprise planning workflows", possibleOpportunity: "Differentiate with evidence-linked decisions", recommendation: "Monitor quarterly", createdAt: updatedAt }]);
    if (/^\/api\/competitors\/\d+$/.test(path)) {
      const item = findById(state.competitors, path, "/api/competitors");
      if (method === "DELETE") return empty();
      if (method === "GET") return json(item);
      Object.assign(item, body, { updatedAt });
      return json(item);
    }
    if (/^\/api\/competitors\/\d+\/analyze$/.test(path)) return json(findById(state.competitors, path, "/api/competitors"));

    if (path === "/api/meetings" && method === "GET") return json(state.meetings);
    if (path === "/api/meetings" && method !== "GET") {
      const created = { id: 430 + state.meetings.length, ...body, analyzed: false, createdAt: updatedAt, updatedAt };
      state.meetings.push(created);
      return json(created);
    }
    if (/^\/api\/meetings\/\d+\/analyze$/.test(path)) return json({ ...findById(state.meetings, path, "/api/meetings"), analyzed: true, opportunitiesExtracted: 1, extractedInsights: { painPoints: ["Evidence is scattered"], featureRequests: ["Signal digest"], risks: [], actionItems: ["Run pilot"], summary: "Demo meeting analysis complete." } });
    if (/^\/api\/meetings\/\d+$/.test(path)) {
      const item = findById(state.meetings, path, "/api/meetings");
      if (method === "DELETE") return empty();
      if (method === "GET") return json({ ...item, extractedInsights: { painPoints: ["Manual synthesis"], featureRequests: ["Weekly digest"], risks: ["Low adoption"], actionItems: ["Pilot with five teams"], summary: "A consistent need for evidence-linked planning." } });
      Object.assign(item, body, { updatedAt });
      return json(item);
    }

    if (path === "/api/feedback" && method === "GET") return json(state.feedback);
    if (path === "/api/feedback" && method !== "GET") {
      const created = { id: 520 + state.feedback.length, ...body, createdAt: updatedAt, updatedAt };
      state.feedback.push(created);
      return json(created);
    }
    if (/^\/api\/feedback\/\d+$/.test(path)) {
      const item = findById(state.feedback, path, "/api/feedback");
      if (method === "DELETE") return empty();
      if (method === "GET") return json(item);
      Object.assign(item, body, { updatedAt });
      return json(item);
    }

    if (path === "/api/insights") return json(state.insights);
    if (path === "/api/insights/trending") return json({
      topProblems: [{ label: "Scattered evidence", score: 92, description: "Repeated across feedback and meetings", trend: "up" }],
      emergingRequests: [{ label: "Signal digest", score: 88, description: "Growing request from PM teams", trend: "up" }],
      fastestGrowingThemes: [{ label: "Roadmap confidence", score: 81, description: "More dependency-related feedback", trend: "up" }],
      competitorTrends: [{ label: "Planning visibility", score: 64, description: "Competitors are adding dependency views", trend: "stable" }],
      marketOpportunities: [{ label: "Evidence-linked decisions", score: 79, description: "Clear opening for an integrated workflow", trend: "up" }],
      stakeholderConcerns: [{ label: "Time to insight", score: 74, description: "Teams want less manual synthesis", trend: "up" }],
    });
    if (path === "/api/insights/generate") return json(state.insights);

    if (path === "/api/prioritization" && method === "GET") return json(state.prioritization);
    if (path === "/api/prioritization/executive-recommendation") return json({ topRecommendation: state.prioritization[0], allRanked: state.prioritization, totalAnalyzed: state.prioritization.length });
    if (path === "/api/prioritization/compare") return json({ opportunityA: state.opportunities[0], opportunityB: state.opportunities[1], analysisA: state.prioritization[0], analysisB: state.prioritization[1], aiInsight: { summary: "The signal digest has stronger evidence and lower delivery risk than dependency visualization." } });
    if (/^\/api\/prioritization\/analyze\/\d+$/.test(path)) return json({ opportunity: findById(state.opportunities, path.replace("/analyze", ""), "/api/prioritization/analyze"), analysis: state.prioritization[0] });
    if (/^\/api\/prioritization\/\d+$/.test(path)) return json(state.prioritization[0]);
    if (path.startsWith("/api/prioritization/")) return json(state.prioritization);

    if (path === "/api/validation/summary") return json({ hypotheses: state.hypotheses.length, experiments: state.experiments.length, evidence: 12, results: 1 });
    if (path === "/api/validation/product-ideas") return json(validationProductIdeas(state));
    if (path === "/api/validation/methods") return json(demoMethods);
    if (path === "/api/validation/hypotheses" && method === "GET") return json(state.hypotheses);
    if (path === "/api/validation/hypotheses" && method !== "GET") {
      const created = { ...state.hypotheses[0], ...body, id: 630 + state.hypotheses.length, createdAt: updatedAt, updatedAt };
      state.hypotheses.push(created);
      return json(created);
    }
    if (path === "/api/validation/hypotheses/improve") return json({ suggestion: "Make the behavior, audience, and measurable outcome explicit so the experiment can falsify it." });
    if (/^\/api\/validation\/hypotheses\/\d+/.test(path)) {
      const item = findById(state.hypotheses, path, "/api/validation/hypotheses");
      if (path.endsWith("/duplicate")) return json({ ...item, id: 699, status: "draft" });
      if (path.endsWith("/archive")) return json({ ...item, archivedAt: updatedAt });
      if (method === "GET") return json(item);
      Object.assign(item, body, { updatedAt });
      return json(item);
    }
    if (path === "/api/validation/experiments" && method === "GET") return json(state.experiments);
    if (path === "/api/validation/experiments" && method !== "GET") return json({ ...state.experiments[0], ...body, id: 730 + state.experiments.length });
    if (/^\/api\/validation\/experiments\/\d+/.test(path)) {
      const item = findById(state.experiments, path, "/api/validation/experiments");
      if (path.endsWith("/archive")) return json({ ...item, archivedAt: updatedAt });
      if (path.endsWith("/analyze-result")) return json({ assessment: "The result supports the hypothesis.", recommendation: "proceed", actualResultQuote: item.actualResult ?? "The pilot result is promising.", successCriteriaQuote: "Activation increased in the pilot.", caveat: null });
      if (method === "GET") return json(item);
      Object.assign(item, body, { updatedAt });
      return json(item);
    }
    if (path === "/api/validation/experiments/assist") return json({ action: "suggest_success_criteria", suggestion: "Measure the percentage of target users who complete the first meaningful workflow within seven days." });

    if (path === "/api/roadmap" && method === "GET") return json(state.roadmap);
    if (path === "/api/roadmap/proposal") return json({ initiatives: [{ name: "Evidence-led decisions", description: "Sequence the strongest opportunities first.", reason: "Highest combined evidence and impact.", items: [{ opportunityId: 101, sequence: 1, startDate: "2026-03-01", endDate: "2026-04-01", status: "planned", progress: 0, notes: "Demo proposal", risks: ["Source connector scope"], why: "Strongest evidence." }] }], generatedAt: updatedAt, source: "ai" });
    if (path.startsWith("/api/roadmap/")) return json(state.roadmap.initiatives[0]);

    if (path === "/api/documents" && method === "GET") return json(state.documents);
    if (path === "/api/documents/generate") return json({ ...state.documents[0], id: 910, status: "ai_generated", humanEdited: false, revision: 1, generationMetadata: { promptVersion: "demo-fixture-v1", model: "deterministic-demo", generatedAt: updatedAt, contextSummary: "Fictional demo context" } });
    if (path.startsWith("/api/documents/context/")) return json({ ...demoContext, documentType: path.split("/").at(-1) ?? "prd" });
    if (/^\/api\/documents\/\d+/.test(path)) {
      const item = findById(state.documents, path, "/api/documents");
      if (path.endsWith("/regenerate")) return json({ ...item, status: "ai_generated", revision: item.revision + 1, humanEdited: false });
      if (path.endsWith("/accept")) return json({ ...item, status: "accepted", acceptedAt: updatedAt, acceptedBy: "demo-user", revision: item.revision + 1 });
      if (method === "GET") return json(item);
      if (method === "PATCH") return json({ ...item, ...body, revision: item.revision + 1, humanEdited: true, updatedAt });
    }

    if (path.startsWith("/api/product-ideas/")) {
      const id = Number(path.split("/")[3]);
      if (path.endsWith("/workspace")) return json(buildOpportunityDetail(state, id));
      if (path.endsWith("/timeline")) return json([{ id: 1, eventType: "created", description: "Product Idea created from customer feedback", createdAt }, { id: 2, eventType: "prioritized", description: "Prioritized with RICE and ICE", createdAt: updatedAt }]);
      if (path.endsWith("/comments")) return json([{ id: 1, ideaId: id, author: "Demo PM", content: "Use the Friday pilot to validate time saved.", createdAt: updatedAt }]);
      if (path.endsWith("/health")) return json({ score: 82, status: "healthy", factors: ["Strong evidence", "Clear owner", "Pilot underway"] });
      if (path.includes("/similarity")) return json({ matches: state.opportunities.filter((item) => item.id !== id).slice(0, 2).map((item) => ({ opportunity: item, similarity: 0.74, reason: "Shares an evidence-to-decision workflow theme." })) });
      return json(buildOpportunityDetail(state, id));
    }
    if (path === "/api/product-ideas/search" || path === "/api/product-ideas/similarity/summary") return json({ items: state.opportunities.slice(0, 3), total: 3 });

    // Unknown demo API calls never fall through to the authenticated backend.
    if (method === "DELETE") return empty();
    return json(Array.isArray(state.opportunities) ? [] : {});
  };

  return () => {
    window.fetch = originalFetch;
  };
}