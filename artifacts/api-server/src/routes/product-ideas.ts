import { Router, type IRouter } from "express";
import { and, eq, desc, ilike, inArray, or } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  opportunitiesTable,
  meetingsTable,
  competitorsTable,
  ideaCommentsTable,
  ideaTimelineTable,
  ideaMeetingsTable,
  ideaCompetitorsTable,
  signalsTable,
  feedbackTable,
  validationHypotheses,
  prioritizationScoresTable,
  prioritizationAnalysisTable,
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

// ─── Similarity / Duplication ─────────────────────────────────────────────────

const relationshipSchema = z.enum(["duplicate", "highly_similar", "related", "unique"]);

const similarityCandidateSchema = z.object({
  candidateProductIdeaId: z.number().int(),
  similarityPercentage: z.number().min(0).max(100),
  relationship: relationshipSchema,
  explanation: z.string().min(1).max(1000),
  keySimilarities: z.array(z.string()).max(6).default([]),
  keyDifferences: z.array(z.string()).max(6).default([]),
  primaryRecommendation: z.object({
    productIdeaId: z.number().int(),
    reason: z.string().min(1).max(500),
  }).optional(),
});

const similarityResponseSchema = z.object({
  candidates: z.array(similarityCandidateSchema).max(50),
});

const compareResponseSchema = z.object({
  similarityPercentage: z.number().min(0).max(100),
  relationship: relationshipSchema,
  explanation: z.string().min(1).max(1000),
  keySimilarities: z.array(z.string()).max(6).default([]),
  keyDifferences: z.array(z.string()).max(6).default([]),
  primaryRecommendation: z.object({
    productIdeaId: z.number().int(),
    reason: z.string().min(1).max(500),
  }).optional(),
});

const compareIdeasSchema = z.object({
  productIdeaAId: z.number().int().positive(),
  productIdeaBId: z.number().int().positive(),
});

const mergeIdeasSchema = z.object({
  primaryProductIdeaId: z.number().int().positive(),
  duplicateProductIdeaId: z.number().int().positive(),
});

const similarityStoredMetadataSchema = z.object({
  sourceProductIdeaId: z.number().int().positive(),
  candidateProductIdeaId: z.number().int().positive().nullable(),
  sourceUpdatedAt: z.string(),
  candidateUpdatedAt: z.string().nullable(),
  similarityPercentage: z.number().min(0).max(100).nullable(),
  relationship: relationshipSchema.nullable(),
  candidateTitle: z.string().nullable(),
});

function ideaForSimilarity(idea: typeof opportunitiesTable.$inferSelect) {
  const compact = (value: string | null, maxLength: number) =>
    value && value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;

  return {
    productIdeaId: idea.id,
    title: idea.title,
    description: compact(idea.description, 600),
    customerProblem: compact(idea.customerProblem, 350),
    businessValue: compact(idea.businessValue, 250),
    category: idea.category,
    sourceType: idea.sourceType,
    status: idea.status,
  };
}

async function storeSimilarityResults(
  source: typeof opportunitiesTable.$inferSelect,
  results: Array<{
    candidateProductIdeaId: number;
    similarityPercentage: number;
    relationship: z.infer<typeof relationshipSchema>;
    candidateTitle: string;
    candidateUpdatedAt: Date;
  }>,
) {
  const rows = results.length > 0
    ? results.flatMap((result) => {
      const candidate = {
        id: result.candidateProductIdeaId,
        title: result.candidateTitle,
        updatedAt: result.candidateUpdatedAt,
      };
      return [
        {
          ideaId: source.id,
          eventType: "similarity_analyzed",
          description: `Similarity checked against "${candidate.title}".`,
          metadata: {
            sourceProductIdeaId: source.id,
            candidateProductIdeaId: candidate.id,
            sourceUpdatedAt: source.updatedAt.toISOString(),
            candidateUpdatedAt: candidate.updatedAt.toISOString(),
            similarityPercentage: result.similarityPercentage,
            relationship: result.relationship,
            candidateTitle: candidate.title,
          } satisfies z.infer<typeof similarityStoredMetadataSchema>,
        },
        {
          ideaId: candidate.id,
          eventType: "similarity_analyzed",
          description: `Similarity checked against "${source.title}".`,
          metadata: {
            sourceProductIdeaId: candidate.id,
            candidateProductIdeaId: source.id,
            sourceUpdatedAt: candidate.updatedAt.toISOString(),
            candidateUpdatedAt: source.updatedAt.toISOString(),
            similarityPercentage: result.similarityPercentage,
            relationship: result.relationship,
            candidateTitle: source.title,
          } satisfies z.infer<typeof similarityStoredMetadataSchema>,
        },
      ];
    })
    : [{
      ideaId: source.id,
      eventType: "similarity_analyzed",
      description: "Similarity checked; no meaningful matches were found.",
      metadata: {
        sourceProductIdeaId: source.id,
        candidateProductIdeaId: null,
        sourceUpdatedAt: source.updatedAt.toISOString(),
        candidateUpdatedAt: null,
        similarityPercentage: null,
        relationship: null,
        candidateTitle: null,
      } satisfies z.infer<typeof similarityStoredMetadataSchema>,
    }];

  await db.insert(ideaTimelineTable).values(rows);
}

function parseAiJson(content: string | null | undefined): unknown {
  return JSON.parse((content ?? "").replace(/```json\n?|\n?```/g, "").trim());
}

async function findOwnedIdea(id: number, userId: string) {
  const [idea] = await db.select().from(opportunitiesTable).where(and(
    eq(opportunitiesTable.id, id),
    eq(opportunitiesTable.userId, userId),
  ));
  return idea;
}

async function callSimilarityAi(prompt: string, responseSchema: z.ZodTypeAny) {
  const { openai } = await import("@workspace/integrations-openai-ai-server");
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 1800,
      messages: [{ role: "user", content: prompt }],
    });
    return responseSchema.parse(parseAiJson(response.choices[0]?.message?.content));
  } catch {
    throw new AppError(502, "Similarity analysis is temporarily unavailable. No Product Ideas were changed.");
  }
}

router.get("/product-ideas/similarity/summary", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const ideas = await db.select({
      id: opportunitiesTable.id,
      updatedAt: opportunitiesTable.updatedAt,
    }).from(opportunitiesTable)
      .where(eq(opportunitiesTable.userId, req.user!.id));

    if (ideas.length === 0) {
      res.json({});
      return;
    }

    const ideaById = new Map(ideas.map((idea) => [idea.id, idea]));
    const events = await db.select({
      ideaId: ideaTimelineTable.ideaId,
      metadata: ideaTimelineTable.metadata,
      createdAt: ideaTimelineTable.createdAt,
    }).from(ideaTimelineTable)
      .where(and(
        eq(ideaTimelineTable.eventType, "similarity_analyzed"),
        inArray(ideaTimelineTable.ideaId, ideas.map((idea) => idea.id)),
      ))
      .orderBy(desc(ideaTimelineTable.createdAt));

    const latestByPair = new Map<string, {
      candidateProductIdeaId: number | null;
      candidateTitle: string | null;
      similarityPercentage: number | null;
      relationship: z.infer<typeof relationshipSchema> | null;
      createdAt: string;
    }>();

    for (const event of events) {
      const parsed = similarityStoredMetadataSchema.safeParse(event.metadata);
      if (!parsed.success) continue;
      const metadata = parsed.data;
      const source = ideaById.get(metadata.sourceProductIdeaId);
      const candidate = metadata.candidateProductIdeaId
        ? ideaById.get(metadata.candidateProductIdeaId)
        : undefined;
      if (!source || (metadata.candidateProductIdeaId && !candidate)) continue;
      if (source.updatedAt.toISOString() !== metadata.sourceUpdatedAt) continue;
      if (candidate && candidate.updatedAt.toISOString() !== metadata.candidateUpdatedAt) continue;

      const pairKey = `${metadata.sourceProductIdeaId}:${metadata.candidateProductIdeaId ?? "none"}`;
      if (latestByPair.has(pairKey)) continue;
      latestByPair.set(pairKey, {
        candidateProductIdeaId: metadata.candidateProductIdeaId,
        candidateTitle: metadata.candidateTitle,
        similarityPercentage: metadata.similarityPercentage,
        relationship: metadata.relationship,
        createdAt: event.createdAt.toISOString(),
      });
    }

    const summary: Record<string, {
      analyzedAt: string;
      matches: Array<{
        candidateProductIdeaId: number;
        candidateTitle: string;
        similarityPercentage: number;
        relationship: z.infer<typeof relationshipSchema>;
      }>;
    }> = {};

    for (const idea of ideas) {
      const matches = [...latestByPair.entries()]
        .filter(([key, value]) => key.startsWith(`${idea.id}:`) && value.candidateProductIdeaId !== null)
        .map(([, value]) => ({
          candidateProductIdeaId: value.candidateProductIdeaId!,
          candidateTitle: value.candidateTitle ?? "Untitled Product Idea",
          similarityPercentage: value.similarityPercentage ?? 0,
          relationship: value.relationship!,
        }))
        .filter((match) => match.similarityPercentage >= 50)
        .sort((a, b) => b.similarityPercentage - a.similarityPercentage)
        .slice(0, 3);
      const marker = latestByPair.get(`${idea.id}:none`);
      const analyzedAt = [...latestByPair.entries()]
        .filter(([key]) => key.startsWith(`${idea.id}:`))
        .map(([, value]) => value.createdAt)
        .sort()
        .at(-1);

      if (analyzedAt || marker) {
        summary[String(idea.id)] = { analyzedAt: analyzedAt ?? marker!.createdAt, matches };
      }
    }

    res.json(summary);
  } catch (err) { next(err); }
});

router.post("/product-ideas/:id/similarity", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError(400, "Invalid id");

    const selected = await findOwnedIdea(id, req.user!.id);
    if (!selected) throw new NotFoundError("Product Idea");

    const accessibleIdeas = await db.select().from(opportunitiesTable)
      .where(eq(opportunitiesTable.userId, req.user!.id))
      .orderBy(desc(opportunitiesTable.createdAt))
      // Match the canonical Product Ideas list's default visible population and
      // keep a single explicit AI request predictably bounded in cost.
      .limit(50);
    const candidates = accessibleIdeas.filter((idea) => idea.id !== id);

    if (candidates.length === 0) {
      await storeSimilarityResults(selected, []);
      res.json({ candidates: [] });
      return;
    }

    const allowedIds = new Set(candidates.map((idea) => idea.id));
    const result = await callSimilarityAi(`You are a product discovery similarity analyst.
Compare the selected Product Idea against the candidate Product Ideas using the underlying customer problem and opportunity, not keyword overlap.
Return ONLY valid JSON matching:
{"candidates":[{"candidateProductIdeaId":number,"similarityPercentage":number 0-100,"relationship":"duplicate"|"highly_similar"|"related"|"unique","explanation":"short explanation","keySimilarities":["..."],"keyDifferences":["..."],"primaryRecommendation":{"productIdeaId":number,"reason":"..."}}]}
Include only meaningful matches at or above 50% similarity. Never invent IDs. A primary recommendation is optional and must be one of the two ideas.

Selected Product Idea:
${JSON.stringify(ideaForSimilarity(selected))}

Candidate Product Ideas:
${candidates.map(ideaForSimilarity).map(JSON.stringify).join("\n")}`, similarityResponseSchema) as z.infer<typeof similarityResponseSchema>;

    const safeCandidates = result.candidates
      .filter((candidate) => allowedIds.has(candidate.candidateProductIdeaId))
      .filter((candidate) => candidate.candidateProductIdeaId !== id)
      .filter((candidate) => candidate.similarityPercentage >= 50)
      .map((candidate) => ({
        ...candidate,
        primaryRecommendation: candidate.primaryRecommendation &&
          [id, candidate.candidateProductIdeaId].includes(candidate.primaryRecommendation.productIdeaId)
          ? candidate.primaryRecommendation
          : undefined,
      }));

    const ideaMap = new Map(candidates.map((idea) => [idea.id, idea]));
    await storeSimilarityResults(
      selected,
      safeCandidates.map((candidate) => ({
        candidateProductIdeaId: candidate.candidateProductIdeaId,
        similarityPercentage: candidate.similarityPercentage,
        relationship: candidate.relationship,
        candidateTitle: ideaMap.get(candidate.candidateProductIdeaId)?.title ?? "Untitled Product Idea",
        candidateUpdatedAt: ideaMap.get(candidate.candidateProductIdeaId)?.updatedAt ?? selected.updatedAt,
      })),
    );
    res.json({
      candidates: safeCandidates.map((candidate) => ({
        ...candidate,
        candidate: { ...ideaMap.get(candidate.candidateProductIdeaId), tags: ideaMap.get(candidate.candidateProductIdeaId)?.tags ?? [] },
      })),
    });
  } catch (err) { next(err); }
});

router.post("/product-ideas/similarity/compare", requireAuth, validate(compareIdeasSchema), async (req, res, next): Promise<void> => {
  try {
    const { productIdeaAId, productIdeaBId } = req.body as z.infer<typeof compareIdeasSchema>;
    if (productIdeaAId === productIdeaBId) throw new AppError(400, "Choose two different Product Ideas");

    const [ideaA, ideaB] = await Promise.all([
      findOwnedIdea(productIdeaAId, req.user!.id),
      findOwnedIdea(productIdeaBId, req.user!.id),
    ]);
    if (!ideaA || !ideaB) throw new NotFoundError("Product Idea");

    const assessment = await callSimilarityAi(`You are a product discovery analyst comparing two Product Ideas.
Assess the underlying customer problem/opportunity, not just shared words. Return ONLY valid JSON matching:
{"similarityPercentage":number 0-100,"relationship":"duplicate"|"highly_similar"|"related"|"unique","explanation":"short explanation","keySimilarities":["..."],"keyDifferences":["..."],"primaryRecommendation":{"productIdeaId":number,"reason":"..."}}
Never invent IDs. The optional primary recommendation must be either ${ideaA.id} or ${ideaB.id}.

Product Idea A:
${JSON.stringify(ideaForSimilarity(ideaA))}

Product Idea B:
${JSON.stringify(ideaForSimilarity(ideaB))}`, compareResponseSchema) as z.infer<typeof compareResponseSchema>;

    const safeAssessment = {
      ...assessment,
      primaryRecommendation: assessment.primaryRecommendation &&
        [ideaA.id, ideaB.id].includes(assessment.primaryRecommendation.productIdeaId)
        ? assessment.primaryRecommendation
        : undefined,
    };
    res.json({
      productIdeaA: { ...ideaA, tags: ideaA.tags ?? [] },
      productIdeaB: { ...ideaB, tags: ideaB.tags ?? [] },
      assessment: safeAssessment,
    });
  } catch (err) { next(err); }
});

router.post("/product-ideas/merge", requireAuth, validate(mergeIdeasSchema), async (req, res, next): Promise<void> => {
  try {
    const { primaryProductIdeaId, duplicateProductIdeaId } = req.body as z.infer<typeof mergeIdeasSchema>;
    if (primaryProductIdeaId === duplicateProductIdeaId) {
      throw new AppError(400, "Primary and duplicate Product Ideas must be different");
    }

    const result = await db.transaction(async (tx) => {
      const [primary, duplicate] = await Promise.all([
        tx.select().from(opportunitiesTable).where(and(
          eq(opportunitiesTable.id, primaryProductIdeaId),
          eq(opportunitiesTable.userId, req.user!.id),
        )),
        tx.select().from(opportunitiesTable).where(and(
          eq(opportunitiesTable.id, duplicateProductIdeaId),
          eq(opportunitiesTable.userId, req.user!.id),
        )),
      ]);
      const keep = primary[0];
      const merge = duplicate[0];
      if (!keep || !merge) throw new NotFoundError("Product Idea");

      const [primaryAnalysis] = await tx.select({ id: prioritizationAnalysisTable.id })
        .from(prioritizationAnalysisTable)
        .where(eq(prioritizationAnalysisTable.opportunityId, keep.id));

      const [
        hypotheses,
        prioritizationScores,
        signals,
        feedback,
        comments,
        timeline,
        meetings,
        competitors,
        analyses,
      ] = await Promise.all([
        tx.update(validationHypotheses)
          .set({ opportunityId: keep.id })
          .where(eq(validationHypotheses.opportunityId, merge.id))
          .returning({ id: validationHypotheses.id }),
        tx.update(prioritizationScoresTable)
          .set({ opportunityId: keep.id })
          .where(eq(prioritizationScoresTable.opportunityId, merge.id))
          .returning({ id: prioritizationScoresTable.id }),
        tx.update(signalsTable)
          .set({ opportunityId: keep.id })
          .where(eq(signalsTable.opportunityId, merge.id))
          .returning({ id: signalsTable.id }),
        tx.update(feedbackTable)
          .set({ opportunityId: keep.id })
          .where(eq(feedbackTable.opportunityId, merge.id))
          .returning({ id: feedbackTable.id }),
        tx.update(ideaCommentsTable)
          .set({ ideaId: keep.id })
          .where(eq(ideaCommentsTable.ideaId, merge.id))
          .returning({ id: ideaCommentsTable.id }),
        tx.update(ideaTimelineTable)
          .set({ ideaId: keep.id })
          .where(eq(ideaTimelineTable.ideaId, merge.id))
          .returning({ id: ideaTimelineTable.id }),
        tx.update(ideaMeetingsTable)
          .set({ ideaId: keep.id })
          .where(eq(ideaMeetingsTable.ideaId, merge.id))
          .returning({ id: ideaMeetingsTable.id }),
        tx.update(ideaCompetitorsTable)
          .set({ ideaId: keep.id })
          .where(eq(ideaCompetitorsTable.ideaId, merge.id))
          .returning({ id: ideaCompetitorsTable.id }),
        ...(primaryAnalysis ? [] : [
          tx.update(prioritizationAnalysisTable)
            .set({ opportunityId: keep.id })
            .where(eq(prioritizationAnalysisTable.opportunityId, merge.id))
            .returning({ id: prioritizationAnalysisTable.id }),
        ]),
      ]);

      await tx.update(opportunitiesTable)
        .set({ status: "archived" })
        .where(eq(opportunitiesTable.id, merge.id));
      await tx.insert(ideaTimelineTable).values({
        ideaId: keep.id,
        eventType: "merged",
        description: `Product Idea "${merge.title}" was merged into this Product Idea and archived.`,
        metadata: {
          duplicateProductIdeaId: merge.id,
          duplicateTitle: merge.title,
          primaryProductIdeaId: keep.id,
          prioritizationAnalysisPreservedOnDuplicate: Boolean(primaryAnalysis),
        },
      });

      return {
        primaryProductIdea: { ...keep, tags: keep.tags ?? [] },
        archivedDuplicateProductIdea: { ...merge, status: "archived", tags: merge.tags ?? [] },
        prioritizationAnalysisPreservedOnDuplicate: Boolean(primaryAnalysis),
        reassigned: {
          hypotheses: hypotheses.length,
          prioritizationScores: prioritizationScores.length,
          prioritizationAnalysis: analyses?.length ?? 0,
          signals: signals.length,
          feedback: feedback.length,
          comments: comments.length,
          timelineEvents: timeline.length,
          meetingLinks: meetings.length,
          competitorLinks: competitors.length,
        },
      };
    });

    res.json({
      ...result,
      message: "Product Ideas merged successfully. The duplicate was archived and related records were preserved.",
    });
  } catch (err) { next(err); }
});

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
