import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  opportunitiesTable,
  signalsTable,
  competitorsTable,
  meetingsTable,
  aiInsightsTable,
} from "@workspace/db";
import { eq, count, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/dashboard/stats", requireAuth, async (req, res, next): Promise<void> => {
  const [
    [oppStats],
    [newOpps],
    [waitingOpps],
    [signalStats],
    [competitorStats],
    [meetingStats],
    sourceBreakdown,
    sentimentBreakdown,
    recentOpps,
    recentMeetings,
    categoryBreakdown,
  ] = await Promise.all([
    db.select({ total: count() }).from(opportunitiesTable),
    db.select({ total: count() }).from(opportunitiesTable).where(eq(opportunitiesTable.status, "new")),
    db.select({ total: count() }).from(opportunitiesTable).where(eq(opportunitiesTable.status, "ready_for_prioritization")),
    db.select({ total: count() }).from(signalsTable),
    db.select({ total: count() }).from(competitorsTable),
    db.select({ total: count() }).from(meetingsTable).where(eq(meetingsTable.analyzed, true)),
    db.select({ sourceType: opportunitiesTable.sourceType, count: count() }).from(opportunitiesTable).groupBy(opportunitiesTable.sourceType),
    db.select({ sentiment: opportunitiesTable.sentiment, count: count() }).from(opportunitiesTable).groupBy(opportunitiesTable.sentiment),
    // Newest opportunities first
    db.select({ id: opportunitiesTable.id, title: opportunitiesTable.title, category: opportunitiesTable.category, status: opportunitiesTable.status, urgency: opportunitiesTable.urgency, sourceType: opportunitiesTable.sourceType, sentiment: opportunitiesTable.sentiment, confidenceScore: opportunitiesTable.confidenceScore, createdAt: opportunitiesTable.createdAt })
      .from(opportunitiesTable).orderBy(desc(opportunitiesTable.createdAt)).limit(10),
    db.select({ title: meetingsTable.title, analyzed: meetingsTable.analyzed }).from(meetingsTable).orderBy(desc(meetingsTable.meetingDate)).limit(5),
    // Category breakdown for pain points vs feature requests
    db.select({ category: opportunitiesTable.category, count: count() }).from(opportunitiesTable).groupBy(opportunitiesTable.category),
  ]);

  // Real top requests — feature_request + improvement categories, by most recent
  const topRequestOpps = recentOpps.filter((o) =>
    !o.category || o.category === "feature_request" || o.category === "improvement" || o.category === "integration"
  ).slice(0, 5);

  const topPainPointOpps = recentOpps.filter((o) =>
    o.category === "pain_point" || o.category === "bug" || o.sentiment === "negative"
  ).slice(0, 5);

  // If not enough categorized, fill from all recent
  const topRequests = (topRequestOpps.length > 0 ? topRequestOpps : recentOpps.slice(0, 5)).map((o) => ({
    label: o.title,
    count: 1,
    trend: null,
  }));

  const topPainPoints = (topPainPointOpps.length > 0 ? topPainPointOpps : recentOpps.slice(0, 4)).map((o) => ({
    label: o.title,
    count: 1,
    trend: null,
  }));

  res.json({
    totalOpportunities: oppStats?.total ?? 0,
    newOpportunities: newOpps?.total ?? 0,
    waitingForPrioritization: waitingOpps?.total ?? 0,
    totalSignals: signalStats?.total ?? 0,
    totalCompetitors: competitorStats?.total ?? 0,
    totalMeetings: meetingStats?.total ?? 0,
    topRequests,
    topPainPoints,
    topCompetitorChanges: [],
    latestMeetingInsights: recentMeetings.map((m) => ({ label: m.title, count: 1, trend: m.analyzed ? "up" : null })),
    sourceBreakdown: sourceBreakdown.map((s) => ({
      sourceType: s.sourceType ?? "unknown",
      count: s.count,
    })),
    sentimentBreakdown: sentimentBreakdown
      .filter((s) => s.sentiment != null)
      .map((s) => ({
        sentiment: s.sentiment!,
        count: s.count,
      })),
    categoryBreakdown: categoryBreakdown
      .filter((c) => c.category != null)
      .map((c) => ({ category: c.category!, count: c.count })),
    recentOpportunities: recentOpps.slice(0, 5),
  });
});

router.get("/dashboard/daily-summary", requireAuth, async (req, res, next): Promise<void> => {
  const [recentInsights, allOpps, urgentOpps, recentMeetings] = await Promise.all([
    db.select().from(aiInsightsTable).orderBy(desc(aiInsightsTable.createdAt)).limit(5),
    db.select({ total: count() }).from(opportunitiesTable),
    db.select().from(opportunitiesTable).where(eq(opportunitiesTable.urgency, "high")).orderBy(desc(opportunitiesTable.createdAt)).limit(5),
    db.select().from(meetingsTable).orderBy(desc(meetingsTable.meetingDate)).limit(3),
  ]);

  const total = allOpps[0]?.total ?? 0;

  let summary = "";
  let keyThemes: string[] = recentInsights.slice(0, 3).map((i) => i.title);
  let recommendations: string[] = [
    "Review new opportunities and update their status",
    "Run AI analysis on recently imported signals",
    "Check competitor intelligence for market changes",
  ];

  if (total > 0) {
    try {
      const { openai } = await import("@workspace/integrations-openai-ai-server");
      const oppContext = urgentOpps.map((o) => `• ${o.title} (urgency: ${o.urgency}, status: ${o.status})`).join("\n");
      const insightContext = recentInsights.map((i) => `• ${i.title}: ${i.content?.substring(0, 100)}`).join("\n");

      const response = await openai.chat.completions.create({
        model: "gpt-5.6-luna",
        max_completion_tokens: 512,
        messages: [{
          role: "user",
          content: `You are a PM copilot. Write a concise daily briefing (2-3 sentences) for a product manager.

Total opportunities: ${total}
High-urgency items:\n${oppContext || "None"}
Recent AI insights:\n${insightContext || "None"}

Also suggest 3 specific, actionable recommendations for today.
Return JSON: { summary: string, keyThemes: string[], recommendations: string[] }
Return only valid JSON.`,
        }],
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
      summary = parsed.summary ?? "";
      if (Array.isArray(parsed.keyThemes) && parsed.keyThemes.length) keyThemes = parsed.keyThemes;
      if (Array.isArray(parsed.recommendations) && parsed.recommendations.length) recommendations = parsed.recommendations;
    } catch {
      summary = `You have ${total} product opportunities in your discovery workspace. ${urgentOpps.length > 0 ? `${urgentOpps.length} high-urgency item${urgentOpps.length > 1 ? "s" : ""} need attention today.` : "Review new signals and prioritize your backlog."}`;
    }
  } else {
    summary = "Welcome to PM Copilot Assist! Start by adding opportunities, importing meeting transcripts, or logging stakeholder feedback to build your product discovery workspace.";
  }

  res.json({
    summary,
    keyThemes,
    urgentItems: urgentOpps.map((o) => ({ id: o.id, title: o.title, urgency: o.urgency, status: o.status })),
    recommendations,
    generatedAt: new Date().toISOString(),
  });
});

export default router;
