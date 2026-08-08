import { Router, type IRouter } from "express";
import { eq, desc, ilike, or } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  opportunitiesTable,
  meetingsTable,
  competitorsTable,
  ideaCommentsTable,
  ideaTimelineTable,
  ideaMeetingsTable,
  ideaCompetitorsTable,
} from "@workspace/db";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validate } from "../middlewares/validate";
import { AppError, NotFoundError } from "../middlewares/errorHandler";
import { buildProductContext, formatContextForPrompt } from "../services/contextEngine";

const router: IRouter = Router();

// ─── Internal Timeline Helper ─────────────────────────────────────────────────

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

// ─── Workspace Aggregate (uses Context Engine) ────────────────────────────────

router.get("/product-ideas/:id/workspace", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError(400, "Invalid id");

    const ctx = await buildProductContext(id);

    res.json({
      idea: { ...ctx.idea, tags: ctx.idea.tags ?? [] },
      evidence: ctx.evidence,
      linkedMeetings: ctx.linkedMeetings,
      linkedCompetitors: ctx.linkedCompetitors,
      timeline: ctx.timeline,
      comments: ctx.comments,
      prioritization: ctx.prioritization,
      relatedIdeas: ctx.relatedIdeas,
      relatedInsights: ctx.relatedInsights,
      health: ctx.health,
      assembledAt: ctx.assembledAt,
    });
  } catch (err) { next(err); }
});

// ─── Comments ─────────────────────────────────────────────────────────────────

const createCommentSchema = z.object({
  content: z.string().min(1, "content is required"),
  author: z.string().optional().default("PM"),
});

router.get("/product-ideas/:id/comments", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError(400, "Invalid id");

    const comments = await db.select().from(ideaCommentsTable)
      .where(eq(ideaCommentsTable.ideaId, id))
      .orderBy(desc(ideaCommentsTable.createdAt));

    res.json(comments);
  } catch (err) { next(err); }
});

router.post(
  "/product-ideas/:id/comments",
  requireAuth,
  validate(createCommentSchema),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError(400, "Invalid id");

      const body = req.body as z.infer<typeof createCommentSchema>;

      const [comment] = await db.insert(ideaCommentsTable).values({
        ideaId: id,
        content: body.content,
        author: req.user?.firstName ?? body.author ?? "PM",
      }).returning();

      await recordTimeline(id, "comment_added", `Comment added by ${comment!.author}`);

      res.status(201).json(comment!);
    } catch (err) { next(err); }
  },
);

router.delete("/product-ideas/:id/comments/:commentId", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const commentId = parseInt(req.params.commentId, 10);
    if (isNaN(id) || isNaN(commentId)) throw new AppError(400, "Invalid id");

    const [deleted] = await db.delete(ideaCommentsTable)
      .where(eq(ideaCommentsTable.id, commentId))
      .returning();

    if (!deleted) throw new NotFoundError("Comment");
    res.sendStatus(204);
  } catch (err) { next(err); }
});

// ─── Timeline ─────────────────────────────────────────────────────────────────

router.get("/product-ideas/:id/timeline", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError(400, "Invalid id");

    const events = await db.select().from(ideaTimelineTable)
      .where(eq(ideaTimelineTable.ideaId, id))
      .orderBy(desc(ideaTimelineTable.createdAt));

    res.json(events);
  } catch (err) { next(err); }
});

// ─── Health Score (uses Context Engine) ──────────────────────────────────────

router.get("/product-ideas/:id/health", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError(400, "Invalid id");

    const ctx = await buildProductContext(id);
    res.json(ctx.health);
  } catch (err) { next(err); }
});

// ─── Link / Unlink Meetings ───────────────────────────────────────────────────

router.post("/product-ideas/:id/link-meeting/:meetingId", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const ideaId = parseInt(req.params.id, 10);
    const meetingId = parseInt(req.params.meetingId, 10);
    if (isNaN(ideaId) || isNaN(meetingId)) throw new AppError(400, "Invalid id");

    const [meeting] = await db.select({ title: meetingsTable.title })
      .from(meetingsTable).where(eq(meetingsTable.id, meetingId));
    if (!meeting) throw new NotFoundError("Meeting");

    // Upsert (ignore duplicate)
    await db.insert(ideaMeetingsTable)
      .values({ ideaId, meetingId })
      .onConflictDoNothing();

    await recordTimeline(ideaId, "meeting_linked", `Meeting linked: ${meeting.title}`, { meetingId });

    res.json({ linked: true, meetingId, meetingTitle: meeting.title });
  } catch (err) { next(err); }
});

router.delete("/product-ideas/:id/link-meeting/:meetingId", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const ideaId = parseInt(req.params.id, 10);
    const meetingId = parseInt(req.params.meetingId, 10);
    if (isNaN(ideaId) || isNaN(meetingId)) throw new AppError(400, "Invalid id");

    await db.delete(ideaMeetingsTable)
      .where(eq(ideaMeetingsTable.ideaId, ideaId));

    res.json({ unlinked: true });
  } catch (err) { next(err); }
});

// ─── Link / Unlink Competitors ────────────────────────────────────────────────

router.post("/product-ideas/:id/link-competitor/:competitorId", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const ideaId = parseInt(req.params.id, 10);
    const competitorId = parseInt(req.params.competitorId, 10);
    if (isNaN(ideaId) || isNaN(competitorId)) throw new AppError(400, "Invalid id");

    const [competitor] = await db.select({ name: competitorsTable.name })
      .from(competitorsTable).where(eq(competitorsTable.id, competitorId));
    if (!competitor) throw new NotFoundError("Competitor");

    await db.insert(ideaCompetitorsTable)
      .values({ ideaId, competitorId })
      .onConflictDoNothing();

    await recordTimeline(ideaId, "competitor_linked", `Competitor linked: ${competitor.name}`, { competitorId });

    res.json({ linked: true, competitorId, competitorName: competitor.name });
  } catch (err) { next(err); }
});

router.delete("/product-ideas/:id/link-competitor/:competitorId", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const ideaId = parseInt(req.params.id, 10);
    const competitorId = parseInt(req.params.competitorId, 10);
    if (isNaN(ideaId) || isNaN(competitorId)) throw new AppError(400, "Invalid id");

    await db.delete(ideaCompetitorsTable)
      .where(eq(ideaCompetitorsTable.ideaId, ideaId));

    res.json({ unlinked: true });
  } catch (err) { next(err); }
});

// ─── AI Duplicate Check (uses Context Engine for richer comparison) ────────────

const duplicateCheckSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
  ideaId: z.number().int().optional(),
});

router.post(
  "/product-ideas/duplicate-check",
  requireAuth,
  validate(duplicateCheckSchema),
  async (req, res, next): Promise<void> => {
    try {
      const body = req.body as z.infer<typeof duplicateCheckSchema>;
      const existing = await db.select({
        id: opportunitiesTable.id,
        title: opportunitiesTable.title,
        description: opportunitiesTable.description,
        status: opportunitiesTable.status,
        category: opportunitiesTable.category,
      }).from(opportunitiesTable).orderBy(desc(opportunitiesTable.createdAt)).limit(30);

      const candidates = existing.filter((o) => !body.ideaId || o.id !== body.ideaId);

      if (candidates.length === 0) {
        res.json({ duplicates: [] });
        return;
      }

      const { openai } = await import("@workspace/integrations-openai-ai-server");

      let duplicates: Array<{ id: number; title: string; similarity: number; reason: string }> = [];

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-5.6-luna",
          max_completion_tokens: 800,
          messages: [{
            role: "user",
            content: `Check for semantic duplicates. New idea:
Title: "${body.title}"
Description: "${body.description}"

Existing ideas:
${candidates.map((o, i) => `[${i}] ID:${o.id} "${o.title}": ${o.description?.substring(0, 100)}`).join("\n")}

Return JSON array of duplicates (similarity >= 0.6):
[{ "id": number, "title": string, "similarity": number (0-1), "reason": string }]
Return [] if no duplicates. Return only valid JSON array.`,
          }],
        });

        const raw = (response.choices[0]?.message?.content ?? "[]").replace(/```json\n?|\n?```/g, "").trim();
        duplicates = JSON.parse(raw);
      } catch {
        // Return empty on AI failure
      }

      res.json({ duplicates: duplicates.filter((d) => d.similarity >= 0.6) });
    } catch (err) { next(err); }
  },
);

// ─── Search ───────────────────────────────────────────────────────────────────

router.get("/product-ideas/search", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const q = (req.query.q as string) ?? "";
    if (!q.trim()) {
      res.json({ ideas: [], meetings: [] });
      return;
    }

    const [ideas, meetings] = await Promise.all([
      db.select({
        id: opportunitiesTable.id,
        title: opportunitiesTable.title,
        status: opportunitiesTable.status,
        category: opportunitiesTable.category,
        urgency: opportunitiesTable.urgency,
      }).from(opportunitiesTable)
        .where(or(
          ilike(opportunitiesTable.title, `%${q}%`),
          ilike(opportunitiesTable.description, `%${q}%`),
          ilike(opportunitiesTable.aiSummary, `%${q}%`),
        ))
        .orderBy(desc(opportunitiesTable.createdAt))
        .limit(20),

      db.select({
        id: meetingsTable.id,
        title: meetingsTable.title,
        meetingDate: meetingsTable.meetingDate,
      }).from(meetingsTable)
        .where(ilike(meetingsTable.title, `%${q}%`))
        .orderBy(desc(meetingsTable.meetingDate))
        .limit(10),
    ]);

    res.json({ ideas, meetings });
  } catch (err) { next(err); }
});

export default router;
