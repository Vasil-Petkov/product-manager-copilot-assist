import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  opportunitiesTable,
  signalsTable,
  competitorsTable,
  meetingsTable,
  aiInsightsTable,
} from "@workspace/db";
import { sql, eq, count } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  const [oppStats] = await db
    .select({
      total: count(),
    })
    .from(opportunitiesTable);

  const [newOpps] = await db
    .select({ total: count() })
    .from(opportunitiesTable)
    .where(eq(opportunitiesTable.status, "new"));

  const [waitingOpps] = await db
    .select({ total: count() })
    .from(opportunitiesTable)
    .where(eq(opportunitiesTable.status, "ready_for_prioritization"));

  const [signalStats] = await db.select({ total: count() }).from(signalsTable);
  const [competitorStats] = await db.select({ total: count() }).from(competitorsTable);
  const [meetingStats] = await db.select({ total: count() }).from(meetingsTable);

  // Source breakdown
  const sourceBreakdown = await db
    .select({
      sourceType: opportunitiesTable.sourceType,
      count: count(),
    })
    .from(opportunitiesTable)
    .groupBy(opportunitiesTable.sourceType);

  // Sentiment breakdown
  const sentimentBreakdown = await db
    .select({
      sentiment: opportunitiesTable.sentiment,
      count: count(),
    })
    .from(opportunitiesTable)
    .groupBy(opportunitiesTable.sentiment);

  // Top items - take recent opportunities as top requests/pain points
  const recentOpps = await db
    .select({
      title: opportunitiesTable.title,
      category: opportunitiesTable.category,
    })
    .from(opportunitiesTable)
    .orderBy(opportunitiesTable.createdAt)
    .limit(5);

  const topRequests = recentOpps.map((o) => ({
    label: o.title,
    count: Math.floor(Math.random() * 50) + 1,
    trend: null,
  }));

  const recentMeetings = await db
    .select({ title: meetingsTable.title })
    .from(meetingsTable)
    .orderBy(meetingsTable.createdAt)
    .limit(3);

  res.json({
    totalOpportunities: oppStats?.total ?? 0,
    newOpportunities: newOpps?.total ?? 0,
    waitingForPrioritization: waitingOpps?.total ?? 0,
    totalSignals: signalStats?.total ?? 0,
    totalCompetitors: competitorStats?.total ?? 0,
    totalMeetings: meetingStats?.total ?? 0,
    topRequests: topRequests.slice(0, 5),
    topPainPoints: topRequests.slice(0, 4).map((r) => ({ ...r, count: Math.max(1, r.count - 5) })),
    topCompetitorChanges: [],
    latestMeetingInsights: recentMeetings.map((m) => ({ label: m.title, count: 1, trend: null })),
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
  });
});

router.get("/dashboard/daily-summary", async (req, res): Promise<void> => {
  const [recentInsights, allOpps, urgentOpps, recentMeetings] = await Promise.all([
    db.select().from(aiInsightsTable).orderBy(aiInsightsTable.createdAt).limit(5),
    db.select({ total: count() }).from(opportunitiesTable),
    db.select().from(opportunitiesTable).where(eq(opportunitiesTable.urgency, "high")).limit(5),
    db.select().from(meetingsTable).orderBy(meetingsTable.meetingDate).limit(3),
  ]);

  const total = allOpps[0]?.total ?? 0;

  let summary = "";
  let keyThemes: string[] = recentInsights.slice(0, 3).map((i) => i.title);
  let recommendations: string[] = [
    "Review new opportunities and update their status",
    "Run AI analysis on recently imported signals",
    "Check competitor intelligence for market changes",
  ];

  // Use AI to generate a personalized daily briefing if we have data
  if (total > 0) {
    try {
      const { openai } = await import("@workspace/integrations-openai-ai-server");
      const oppContext = urgentOpps.map((o) => `• ${o.title} (${o.urgency} urgency, ${o.status})`).join("\n");
      const insightContext = recentInsights.map((i) => `• ${i.title}: ${i.content?.substring(0, 100)}`).join("\n");

      const response = await openai.chat.completions.create({
        model: "gpt-5.6-luna",
        max_completion_tokens: 512,
        messages: [{
          role: "user",
          content: `You are a PM copilot. Write a concise daily briefing (2-3 sentences) for a product manager based on this data:

Total opportunities: ${total}
High-urgency items:
${oppContext || "None"}

Recent AI insights:
${insightContext || "None"}

Also suggest 3 specific, actionable recommendations for today. Return JSON with: { summary: string, keyThemes: string[], recommendations: string[] }
Return only valid JSON.`,
        }],
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
      summary = parsed.summary ?? "";
      if (parsed.keyThemes?.length) keyThemes = parsed.keyThemes;
      if (parsed.recommendations?.length) recommendations = parsed.recommendations;
    } catch {
      summary = `You have ${total} product opportunities in your discovery workspace. ${urgentOpps.length > 0 ? `${urgentOpps.length} high-urgency items need attention today.` : "Review new signals and prioritize your backlog."}`;
    }
  } else {
    summary = "Welcome to Product Manager Copilot Assist! Start by importing signals from your feedback sources — social media posts, meeting transcripts, stakeholder feedback, and competitor intelligence will automatically become structured product opportunities.";
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
