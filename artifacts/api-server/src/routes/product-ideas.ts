import { Router, type IRouter } from "express";
import { eq, desc, ilike, or, and, SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  opportunitiesTable,
  signalsTable,
  feedbackTable,
  meetingsTable,
  competitorsTable,
  ideaCommentsTable,
  ideaTimelineTable,
  ideaMeetingsTable,
  ideaCompetitorsTable,
} from "@workspace/db";

const router: IRouter = Router();

// ─── Internal helper ────────────────────────────────────────────────────────

export async function recordTimeline(
  ideaId: number,
  eventType: string,
  description: string,
  metadata?: Record<string, unknown>
) {
  try {
    await db.insert(ideaTimelineTable).values({
      ideaId,
      eventType,
      description,
      metadata: metadata ?? null,
    });
  } catch {
    // Non-critical — swallow errors so main request never fails
  }
}

// ─── Workspace ──────────────────────────────────────────────────────────────

router.get("/product-ideas/:id/workspace", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [idea] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id));
  if (!idea) { res.status(404).json({ error: "Not found" }); return; }

  const [
    relatedSignals,
    relatedFeedback,
    linkedMeetingRows,
    linkedCompetitorRows,
    commentCount,
    timelineCount,
  ] = await Promise.all([
    db.select().from(signalsTable).where(eq(signalsTable.opportunityId, String(id))),
    db.select().from(feedbackTable).where(eq(feedbackTable.opportunityId, String(id))),
    db.select({ meetingId: ideaMeetingsTable.meetingId })
      .from(ideaMeetingsTable).where(eq(ideaMeetingsTable.ideaId, id)),
    db.select({ competitorId: ideaCompetitorsTable.competitorId })
      .from(ideaCompetitorsTable).where(eq(ideaCompetitorsTable.ideaId, id)),
    db.select().from(ideaCommentsTable).where(eq(ideaCommentsTable.ideaId, id)),
    db.select().from(ideaTimelineTable).where(eq(ideaTimelineTable.ideaId, id)),
  ]);

  // Resolve linked objects
  const linkedMeetings = linkedMeetingRows.length > 0
    ? await db.select().from(meetingsTable).where(
        or(...linkedMeetingRows.map(r => eq(meetingsTable.id, r.meetingId)))!
      )
    : [];
  const linkedCompetitors = linkedCompetitorRows.length > 0
    ? await db.select().from(competitorsTable).where(
        or(...linkedCompetitorRows.map(r => eq(competitorsTable.id, r.competitorId)))!
      )
    : [];

  const socialSignals = relatedSignals.filter(s => s.sourceType === "social_media");

  const evidence = {
    customerRequestCount: relatedSignals.length,
    stakeholderMentions: relatedFeedback.length,
    meetingMentions: linkedMeetings.length,
    competitorReferences: linkedCompetitors.length,
    socialMentions: socialSignals.length,
    exampleQuotes: relatedSignals.slice(0, 4).map(s => s.content.substring(0, 200)),
    sourceLinks: relatedSignals.filter(s => s.sourceUrl).map(s => s.sourceUrl!).slice(0, 5),
    feedbackQuotes: relatedFeedback.slice(0, 3).map(f => f.description.substring(0, 200)),
  };

  // Compute health score inline
  const health = computeHealthScore({
    signals: relatedSignals.length,
    feedback: relatedFeedback.length,
    meetings: linkedMeetings.length,
    competitors: linkedCompetitors.length,
    confidenceScore: idea.confidenceScore ?? 0,
    sourceTypes: [...new Set(relatedSignals.map(s => s.sourceType))].length,
    updatedAt: idea.updatedAt,
  });

  res.json({
    idea: { ...idea, tags: idea.tags ?? [], openQuestions: idea.openQuestions ?? [] },
    evidence,
    linkedMeetings: linkedMeetings.map(m => ({ ...m, attendees: m.attendees ?? [] })),
    linkedCompetitors,
    relatedSignals: relatedSignals.slice(0, 20).map(s => ({
      ...s,
      opportunityId: s.opportunityId ? parseInt(s.opportunityId, 10) : null,
    })),
    relatedFeedback,
    commentCount: commentCount.length,
    timelineCount: timelineCount.length,
    health,
  });
});

// ─── Comments ────────────────────────────────────────────────────────────────

router.get("/product-ideas/:id/comments", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const comments = await db
    .select()
    .from(ideaCommentsTable)
    .where(eq(ideaCommentsTable.ideaId, id))
    .orderBy(desc(ideaCommentsTable.createdAt));

  res.json(comments);
});

router.post("/product-ideas/:id/comments", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { content, author } = req.body;
  if (!content || typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const [comment] = await db
    .insert(ideaCommentsTable)
    .values({ ideaId: id, author: author?.trim() || "PM", content: content.trim() })
    .returning();

  await recordTimeline(id, "comment_added", `Comment added by ${comment!.author}`);

  res.status(201).json(comment!);
});

router.delete("/product-ideas/:id/comments/:commentId", async (req, res): Promise<void> => {
  const ideaId = parseInt(req.params.id, 10);
  const commentId = parseInt(req.params.commentId, 10);
  if (isNaN(ideaId) || isNaN(commentId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db
    .delete(ideaCommentsTable)
    .where(and(eq(ideaCommentsTable.id, commentId), eq(ideaCommentsTable.ideaId, ideaId)))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

// ─── Timeline ────────────────────────────────────────────────────────────────

router.get("/product-ideas/:id/timeline", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const events = await db
    .select()
    .from(ideaTimelineTable)
    .where(eq(ideaTimelineTable.ideaId, id))
    .orderBy(desc(ideaTimelineTable.createdAt));

  res.json(events);
});

// ─── Health Score ─────────────────────────────────────────────────────────────

router.get("/product-ideas/:id/health", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [idea] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id));
  if (!idea) { res.status(404).json({ error: "Not found" }); return; }

  const [signals, feedback, linkedMeetingRows, linkedCompetitorRows] = await Promise.all([
    db.select().from(signalsTable).where(eq(signalsTable.opportunityId, String(id))),
    db.select().from(feedbackTable).where(eq(feedbackTable.opportunityId, String(id))),
    db.select({ meetingId: ideaMeetingsTable.meetingId }).from(ideaMeetingsTable).where(eq(ideaMeetingsTable.ideaId, id)),
    db.select({ competitorId: ideaCompetitorsTable.competitorId }).from(ideaCompetitorsTable).where(eq(ideaCompetitorsTable.ideaId, id)),
  ]);

  const health = computeHealthScore({
    signals: signals.length,
    feedback: feedback.length,
    meetings: linkedMeetingRows.length,
    competitors: linkedCompetitorRows.length,
    confidenceScore: idea.confidenceScore ?? 0,
    sourceTypes: [...new Set(signals.map(s => s.sourceType))].length,
    updatedAt: idea.updatedAt,
  });

  res.json(health);
});

// ─── Link / Unlink Meetings ──────────────────────────────────────────────────

router.post("/product-ideas/:id/link-meeting/:meetingId", async (req, res): Promise<void> => {
  const ideaId = parseInt(req.params.id, 10);
  const meetingId = parseInt(req.params.meetingId, 10);
  if (isNaN(ideaId) || isNaN(meetingId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [meeting] = await db.select().from(meetingsTable).where(eq(meetingsTable.id, meetingId));
  if (!meeting) { res.status(404).json({ error: "Meeting not found" }); return; }

  // Upsert — ignore if already linked
  const existing = await db.select()
    .from(ideaMeetingsTable)
    .where(and(eq(ideaMeetingsTable.ideaId, ideaId), eq(ideaMeetingsTable.meetingId, meetingId)));

  if (existing.length === 0) {
    await db.insert(ideaMeetingsTable).values({ ideaId, meetingId });
    await recordTimeline(ideaId, "meeting_linked", `Meeting linked: ${meeting.title}`, { meetingId });
  }

  res.json({ linked: true, meetingId, meetingTitle: meeting.title });
});

router.delete("/product-ideas/:id/link-meeting/:meetingId", async (req, res): Promise<void> => {
  const ideaId = parseInt(req.params.id, 10);
  const meetingId = parseInt(req.params.meetingId, 10);
  if (isNaN(ideaId) || isNaN(meetingId)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(ideaMeetingsTable)
    .where(and(eq(ideaMeetingsTable.ideaId, ideaId), eq(ideaMeetingsTable.meetingId, meetingId)));

  res.sendStatus(204);
});

// ─── Link / Unlink Competitors ───────────────────────────────────────────────

router.post("/product-ideas/:id/link-competitor/:competitorId", async (req, res): Promise<void> => {
  const ideaId = parseInt(req.params.id, 10);
  const competitorId = parseInt(req.params.competitorId, 10);
  if (isNaN(ideaId) || isNaN(competitorId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [competitor] = await db.select().from(competitorsTable).where(eq(competitorsTable.id, competitorId));
  if (!competitor) { res.status(404).json({ error: "Competitor not found" }); return; }

  const existing = await db.select()
    .from(ideaCompetitorsTable)
    .where(and(eq(ideaCompetitorsTable.ideaId, ideaId), eq(ideaCompetitorsTable.competitorId, competitorId)));

  if (existing.length === 0) {
    await db.insert(ideaCompetitorsTable).values({ ideaId, competitorId });
    await recordTimeline(ideaId, "competitor_linked", `Competitor linked: ${competitor.name}`, { competitorId });
  }

  res.json({ linked: true, competitorId, competitorName: competitor.name });
});

router.delete("/product-ideas/:id/link-competitor/:competitorId", async (req, res): Promise<void> => {
  const ideaId = parseInt(req.params.id, 10);
  const competitorId = parseInt(req.params.competitorId, 10);
  if (isNaN(ideaId) || isNaN(competitorId)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(ideaCompetitorsTable)
    .where(and(eq(ideaCompetitorsTable.ideaId, ideaId), eq(ideaCompetitorsTable.competitorId, competitorId)));

  res.sendStatus(204);
});

// ─── Duplicate Detection ─────────────────────────────────────────────────────

router.post("/product-ideas/duplicate-check", async (req, res): Promise<void> => {
  const { title, description } = req.body;
  if (!title || !description) { res.status(400).json({ error: "title and description required" }); return; }

  // Get existing ideas to compare against
  const existing = await db
    .select({ id: opportunitiesTable.id, title: opportunitiesTable.title, description: opportunitiesTable.description })
    .from(opportunitiesTable)
    .orderBy(desc(opportunitiesTable.createdAt))
    .limit(30);

  if (existing.length === 0) { res.json({ duplicates: [] }); return; }

  try {
    const { openai } = await import("@workspace/integrations-openai-ai-server");

    const prompt = `You are a product deduplication engine. Given a new product idea and a list of existing ones, find any that are semantically similar (same problem, feature, or domain).

New idea:
Title: ${title}
Description: ${description}

Existing ideas (id, title, description):
${existing.map(e => `[${e.id}] "${e.title}" — ${e.description.substring(0, 120)}`).join("\n")}

Return a JSON array of matches with similarity > 0.6:
[{ "id": number, "title": string, "similarity": number (0-1), "reason": string }]

Return only valid JSON. Empty array if no matches.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (response.choices[0]?.message?.content ?? "[]").replace(/```json\n?|\n?```/g, "").trim();
    const matches = JSON.parse(raw);

    res.json({ duplicates: Array.isArray(matches) ? matches.slice(0, 3) : [] });
  } catch {
    res.json({ duplicates: [] });
  }
});

// ─── Global Search ───────────────────────────────────────────────────────────

router.get("/product-ideas/search", async (req, res): Promise<void> => {
  const q = (req.query.q as string)?.trim();
  if (!q || q.length < 2) { res.json({ ideas: [], meetings: [], competitors: [] }); return; }

  const conditions: SQL[] = [
    ilike(opportunitiesTable.title, `%${q}%`),
    ilike(opportunitiesTable.description, `%${q}%`),
  ];
  if (opportunitiesTable.customerProblem) conditions.push(ilike(opportunitiesTable.customerProblem, `%${q}%`));
  if (opportunitiesTable.aiSummary) conditions.push(ilike(opportunitiesTable.aiSummary, `%${q}%`));

  const [ideas, meetings, competitors] = await Promise.all([
    db.select({
      id: opportunitiesTable.id,
      title: opportunitiesTable.title,
      description: opportunitiesTable.description,
      status: opportunitiesTable.status,
      category: opportunitiesTable.category,
      confidenceScore: opportunitiesTable.confidenceScore,
    }).from(opportunitiesTable).where(or(...conditions)!).orderBy(desc(opportunitiesTable.createdAt)).limit(10),

    db.select({ id: meetingsTable.id, title: meetingsTable.title })
      .from(meetingsTable).where(ilike(meetingsTable.title, `%${q}%`)).limit(5),

    db.select({ id: competitorsTable.id, name: competitorsTable.name, industry: competitorsTable.industry })
      .from(competitorsTable).where(ilike(competitorsTable.name, `%${q}%`)).limit(5),
  ]);

  res.json({ ideas, meetings, competitors, query: q });
});

// ─── Health Score Computation ────────────────────────────────────────────────

function computeHealthScore(params: {
  signals: number;
  feedback: number;
  meetings: number;
  competitors: number;
  confidenceScore: number;
  sourceTypes: number;
  updatedAt: Date;
}): {
  score: number;
  grade: string;
  breakdown: Record<string, { label: string; value: number; max: number; score: number }>;
} {
  const { signals, feedback, meetings, competitors, confidenceScore, sourceTypes, updatedAt } = params;

  // Each dimension → normalized score
  const customerDemand = Math.min(signals / 10, 1) * 25;
  const stakeholderSupport = Math.min(feedback / 3, 1) * 20;
  const meetingFrequency = Math.min(meetings / 2, 1) * 15;
  const competitorContext = Math.min(competitors / 2, 1) * 15;
  const aiConfidence = (confidenceScore ?? 0) * 15;
  const evidenceQuality = Math.min(sourceTypes / 3, 1) * 10;

  // Freshness: ideas not updated in 30+ days lose points
  const daysSinceUpdate = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  const freshness = Math.max(0, 1 - daysSinceUpdate / 60) * 0; // 0 weight for now (no stale data yet)

  const score = Math.round(customerDemand + stakeholderSupport + meetingFrequency + competitorContext + aiConfidence + evidenceQuality + freshness);

  const grade = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : score >= 20 ? "D" : "F";

  return {
    score,
    grade,
    breakdown: {
      customerDemand: { label: "Customer Demand", value: signals, max: 10, score: Math.round(customerDemand) },
      stakeholderSupport: { label: "Stakeholder Support", value: feedback, max: 3, score: Math.round(stakeholderSupport) },
      meetingFrequency: { label: "Meeting Evidence", value: meetings, max: 2, score: Math.round(meetingFrequency) },
      competitorContext: { label: "Competitor Context", value: competitors, max: 2, score: Math.round(competitorContext) },
      aiConfidence: { label: "AI Confidence", value: Math.round(confidenceScore * 100), max: 100, score: Math.round(aiConfidence) },
      evidenceQuality: { label: "Source Diversity", value: sourceTypes, max: 3, score: Math.round(evidenceQuality) },
    },
  };
}

export default router;
