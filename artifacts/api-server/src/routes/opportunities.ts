import { Router, type IRouter } from "express";
import { eq, ilike, and, desc, SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { opportunitiesTable, signalsTable, feedbackTable } from "@workspace/db";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validate } from "../middlewares/validate";
import { NotFoundError, AppError } from "../middlewares/errorHandler";
import { recordTimeline } from "./product-ideas";
import { buildProductContext, formatContextForPrompt } from "../services/contextEngine";

const router: IRouter = Router();

// ─── Validation Schemas ──────────────────────────────────────────────────────

const createOpportunitySchema = z.object({
  title: z.string().min(1, "title is required").max(500),
  description: z.string().min(1, "description is required").max(10000),
  sourceType: z.string().optional().default("manual"),
  category: z.string().optional().nullable(),
  originalContent: z.string().optional().nullable(),
  customerProblem: z.string().optional().nullable(),
  suggestedSolution: z.string().optional().nullable(),
  businessValue: z.string().optional().nullable(),
  urgency: z.enum(["low", "medium", "high", "critical"]).optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  status: z.string().optional().default("new"),
  owner: z.string().optional().nullable(),
});

const updateOpportunitySchema = createOpportunitySchema.partial();

// ─── List ────────────────────────────────────────────────────────────────────

router.get("/opportunities", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const { status, category, source_type, sentiment, search, limit = "50", offset = "0" } =
      req.query as Record<string, string>;

    const take = Math.min(parseInt(limit, 10) || 50, 200);
    const skip = parseInt(offset, 10) || 0;

    // Product Ideas are user-owned throughout the application. Keep the
    // Discovery list aligned with Validation's getOwnedOpportunity check so
    // every idea offered by the shared selector can be attached successfully.
    const conditions: SQL[] = [eq(opportunitiesTable.userId, req.user!.id)];
    if (status) conditions.push(eq(opportunitiesTable.status, status));
    if (category) conditions.push(eq(opportunitiesTable.category, category));
    if (source_type) conditions.push(eq(opportunitiesTable.sourceType, source_type));
    if (sentiment) conditions.push(eq(opportunitiesTable.sentiment, sentiment));
    if (search) conditions.push(ilike(opportunitiesTable.title, `%${search}%`));

    const opps = conditions.length > 0
      ? await db.select().from(opportunitiesTable).where(and(...conditions))
          .orderBy(desc(opportunitiesTable.createdAt)).limit(take).offset(skip)
      : await db.select().from(opportunitiesTable)
          .orderBy(desc(opportunitiesTable.createdAt)).limit(take).offset(skip);

    res.json(opps.map((o) => ({ ...o, tags: o.tags ?? [] })));
  } catch (err) { next(err); }
});

// ─── Create ──────────────────────────────────────────────────────────────────

router.post(
  "/opportunities",
  requireAuth,
  validate(createOpportunitySchema),
  async (req, res, next): Promise<void> => {
    try {
      const body = req.body as z.infer<typeof createOpportunitySchema>;
      const [opp] = await db.insert(opportunitiesTable).values({
        title: body.title.trim(),
        description: body.description.trim(),
        sourceType: body.sourceType ?? "manual",
        category: body.category ?? null,
        originalContent: body.originalContent ?? null,
        customerProblem: body.customerProblem ?? null,
        suggestedSolution: body.suggestedSolution ?? null,
        businessValue: body.businessValue ?? null,
        urgency: body.urgency ?? null,
        tags: body.tags ?? [],
        status: body.status ?? "new",
        owner: body.owner ?? null,
        userId: req.user!.id,
      }).returning();

      await recordTimeline(opp!.id, "created", `Product Idea created from ${body.sourceType ?? "manual"} source`);

      res.status(201).json({ ...opp!, tags: opp!.tags ?? [] });
    } catch (err) { next(err); }
  },
);

// ─── Get One ─────────────────────────────────────────────────────────────────

router.get("/opportunities/:id", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError(400, "Invalid id");

    const [opp] = await db.select().from(opportunitiesTable).where(and(
      eq(opportunitiesTable.id, id),
      eq(opportunitiesTable.userId, req.user!.id),
    ));
    if (!opp) throw new NotFoundError("Product Idea");

    const [relatedSignals, relatedFeedback] = await Promise.all([
      db.select().from(signalsTable).where(eq(signalsTable.opportunityId, id)),
      db.select().from(feedbackTable).where(eq(feedbackTable.opportunityId, id)),
    ]);

    const evidence = {
      customerRequestCount: relatedSignals.length,
      stakeholderMentions: relatedFeedback.length,
      meetingMentions: 0,
      competitorReferences: 0,
      socialMentions: relatedSignals.filter((s) => s.sourceType === "social_media").length,
      exampleQuotes: relatedSignals.slice(0, 3).map((s) => s.content.substring(0, 150)),
      sourceLinks: relatedSignals.filter((s) => s.sourceUrl).map((s) => s.sourceUrl!),
    };

    res.json({
      ...opp,
      tags: opp.tags ?? [],
      evidence,
      relatedSignals,
    });
  } catch (err) { next(err); }
});

// ─── Update ──────────────────────────────────────────────────────────────────

router.patch(
  "/opportunities/:id",
  requireAuth,
  validate(updateOpportunitySchema),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError(400, "Invalid id");

      const body = req.body as z.infer<typeof updateOpportunitySchema>;
      const updateData: Record<string, unknown> = {};

      const allowedFields = [
        "title", "description", "category", "sourceType", "originalContent",
        "customerProblem", "suggestedSolution", "businessValue", "customerValue",
        "dependencies", "aiRecommendation", "urgency", "tags", "status", "owner",
        "problemStatement", "rootCause", "openQuestions",
      ] as const;

      for (const field of allowedFields) {
        if ((body as Record<string, unknown>)[field] !== undefined) {
          updateData[field] = (body as Record<string, unknown>)[field];
        }
      }

      if (Object.keys(updateData).length === 0) {
        throw new AppError(400, "No fields to update");
      }

      const [updated] = await db
        .update(opportunitiesTable)
        .set(updateData as never)
        .where(and(
          eq(opportunitiesTable.id, id),
          eq(opportunitiesTable.userId, req.user!.id),
        ))
        .returning();

      if (!updated) throw new NotFoundError("Product Idea");
      res.json({ ...updated, tags: updated.tags ?? [] });
    } catch (err) { next(err); }
  },
);

// ─── Delete ──────────────────────────────────────────────────────────────────

router.delete("/opportunities/:id", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError(400, "Invalid id");

    const [deleted] = await db
      .delete(opportunitiesTable)
      .where(and(
        eq(opportunitiesTable.id, id),
        eq(opportunitiesTable.userId, req.user!.id),
      ))
      .returning();

    if (!deleted) throw new NotFoundError("Product Idea");
    res.sendStatus(204);
  } catch (err) { next(err); }
});

// ─── AI Analyze (via Context Engine) ─────────────────────────────────────────

router.post("/opportunities/:id/analyze", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError(400, "Invalid id");

    const [ownedIdea] = await db.select({ id: opportunitiesTable.id })
      .from(opportunitiesTable)
      .where(and(
        eq(opportunitiesTable.id, id),
        eq(opportunitiesTable.userId, req.user!.id),
      ));
    if (!ownedIdea) throw new NotFoundError("Product Idea");

    // 1. Build full product context before calling AI
    const ctx = await buildProductContext(id);
    const contextStr = formatContextForPrompt(ctx);

    const { openai } = await import("@workspace/integrations-openai-ai-server");
    let aiResult: Record<string, unknown> = {};

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.6-luna",
        max_completion_tokens: 1500,
        messages: [{
          role: "user",
          content: `You are an expert product manager. Analyze this product idea using ALL available context.

${contextStr}

Return a JSON object with:
- summary (string): concise executive summary (2-3 sentences)
- problemStatement (string): clear problem statement
- rootCause (string): root cause analysis
- customerValue (string): customer value proposition
- estimatedCustomerImpact (string): customer impact estimate
- estimatedBusinessImpact (string): business impact estimate
- dependencies (string): key dependencies or blockers
- aiRecommendation (string): your strategic recommendation
- openQuestions (string[]): 3-5 open questions that need answers
- sentiment (string): positive|neutral|negative
- urgency (string): low|medium|high|critical
- category (string): feature_request|pain_point|market_opportunity|improvement|integration
- confidenceScore (number 0-1): confidence in this analysis

Return only valid JSON, no markdown.`,
        }],
      });

      const raw = (response.choices[0]?.message?.content ?? "{}").replace(/```json\n?|\n?```/g, "").trim();
      aiResult = JSON.parse(raw);
    } catch {
      aiResult = {
        summary: `${ctx.idea.title} requires attention based on ${ctx.evidence.customerRequestCount} customer requests and ${ctx.evidence.stakeholderMentions} stakeholder mentions.`,
        sentiment: ctx.idea.sentiment ?? "neutral",
        urgency: ctx.idea.urgency ?? "medium",
        category: ctx.idea.category ?? "feature_request",
        confidenceScore: 0.5,
        estimatedCustomerImpact: "To be assessed",
        estimatedBusinessImpact: "To be assessed",
      };
    }

    const [updated] = await db
      .update(opportunitiesTable)
      .set({
        aiSummary: typeof aiResult.summary === "string" ? aiResult.summary : null,
        problemStatement: typeof aiResult.problemStatement === "string" ? aiResult.problemStatement : null,
        rootCause: typeof aiResult.rootCause === "string" ? aiResult.rootCause : null,
        customerValue: typeof aiResult.customerValue === "string" ? aiResult.customerValue : null,
        dependencies: typeof aiResult.dependencies === "string" ? aiResult.dependencies : null,
        aiRecommendation: typeof aiResult.aiRecommendation === "string" ? aiResult.aiRecommendation : null,
        openQuestions: Array.isArray(aiResult.openQuestions) ? aiResult.openQuestions as string[] : [],
        sentiment: typeof aiResult.sentiment === "string" ? aiResult.sentiment : null,
        urgency: typeof aiResult.urgency === "string" ? aiResult.urgency : null,
        category: typeof aiResult.category === "string" ? aiResult.category : ctx.idea.category,
        confidenceScore: typeof aiResult.confidenceScore === "number" ? aiResult.confidenceScore : null,
        estimatedCustomerImpact: typeof aiResult.estimatedCustomerImpact === "string" ? aiResult.estimatedCustomerImpact : null,
        estimatedBusinessImpact: typeof aiResult.estimatedBusinessImpact === "string" ? aiResult.estimatedBusinessImpact : null,
        healthScore: ctx.health.score,
      })
      .where(eq(opportunitiesTable.id, id))
      .returning();

    await recordTimeline(id, "ai_analyzed", "AI analysis completed using full product context", {
      sentiment: updated!.sentiment,
      urgency: updated!.urgency,
      confidenceScore: updated!.confidenceScore,
      meetingsConsidered: ctx.linkedMeetings.length,
      competitorsConsidered: ctx.linkedCompetitors.length,
    });

    res.json({ ...updated!, tags: updated!.tags ?? [] });
  } catch (err) { next(err); }
});

export default router;
