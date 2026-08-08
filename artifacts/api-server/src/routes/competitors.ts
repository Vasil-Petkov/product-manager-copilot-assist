import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { competitorsTable, competitorReportsTable } from "@workspace/db";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validate } from "../middlewares/validate";
import { AppError, NotFoundError } from "../middlewares/errorHandler";

const router: IRouter = Router();

const createCompetitorSchema = z.object({
  name: z.string().min(1, "name is required"),
  website: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateCompetitorSchema = createCompetitorSchema.partial();

// ─── List ────────────────────────────────────────────────────────────────────

router.get("/competitors", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const { limit = "50", offset = "0" } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit, 10) || 50, 200);
    const skip = parseInt(offset, 10) || 0;

    const competitors = await db.select().from(competitorsTable)
      .orderBy(desc(competitorsTable.createdAt)).limit(take).offset(skip);

    res.json(competitors);
  } catch (err) { next(err); }
});

// ─── Create ──────────────────────────────────────────────────────────────────

router.post(
  "/competitors",
  requireAuth,
  validate(createCompetitorSchema),
  async (req, res, next): Promise<void> => {
    try {
      const body = req.body as z.infer<typeof createCompetitorSchema>;
      const [competitor] = await db.insert(competitorsTable).values({
        name: body.name,
        website: body.website ?? null,
        description: body.description ?? null,
        industry: body.industry ?? null,
        notes: body.notes ?? null,
        userId: req.user!.id,
      }).returning();

      res.status(201).json(competitor!);
    } catch (err) { next(err); }
  },
);

// ─── Get One ─────────────────────────────────────────────────────────────────

router.get("/competitors/:id", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError(400, "Invalid id");

    const [competitor] = await db.select().from(competitorsTable)
      .where(eq(competitorsTable.id, id));
    if (!competitor) throw new NotFoundError("Competitor");

    res.json(competitor);
  } catch (err) { next(err); }
});

// ─── Update ──────────────────────────────────────────────────────────────────

router.patch(
  "/competitors/:id",
  requireAuth,
  validate(updateCompetitorSchema),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError(400, "Invalid id");

      const body = req.body as z.infer<typeof updateCompetitorSchema>;
      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.website !== undefined) updateData.website = body.website;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.industry !== undefined) updateData.industry = body.industry;
      if (body.notes !== undefined) updateData.notes = body.notes;

      const [updated] = await db.update(competitorsTable)
        .set(updateData as never)
        .where(eq(competitorsTable.id, id))
        .returning();

      if (!updated) throw new NotFoundError("Competitor");
      res.json(updated);
    } catch (err) { next(err); }
  },
);

// ─── Delete ──────────────────────────────────────────────────────────────────

router.delete("/competitors/:id", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError(400, "Invalid id");

    const [deleted] = await db.delete(competitorsTable)
      .where(eq(competitorsTable.id, id))
      .returning();
    if (!deleted) throw new NotFoundError("Competitor");
    res.sendStatus(204);
  } catch (err) { next(err); }
});

// ─── AI Analyze ──────────────────────────────────────────────────────────────

router.post("/competitors/:id/analyze", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError(400, "Invalid id");

    const [competitor] = await db.select().from(competitorsTable)
      .where(eq(competitorsTable.id, id));
    if (!competitor) throw new NotFoundError("Competitor");

    const { openai } = await import("@workspace/integrations-openai-ai-server");
    let analysis: Record<string, unknown> = {};

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.6-luna",
        max_completion_tokens: 1500,
        messages: [{
          role: "user",
          content: `You are a competitive intelligence analyst.

Competitor: ${competitor.name}
Website: ${competitor.website ?? "Unknown"}
Industry: ${competitor.industry ?? "Unknown"}
Description: ${competitor.description ?? "No description"}
Notes: ${competitor.notes ?? "No notes"}
Previous Analysis: ${competitor.latestAnalysis ?? "None"}

Provide a competitive analysis. Return JSON:
{
  "summary": "2-3 paragraph analysis",
  "newFeatures": ["feature1", "feature2"],
  "pricingChanges": "pricing observations",
  "businessImpact": "impact on our product",
  "possibleThreat": "specific threats",
  "possibleOpportunity": "opportunities this creates",
  "recommendation": "strategic recommendation",
  "threatLevel": "low|medium|high|critical"
}`,
        }],
      });

      const raw = (response.choices[0]?.message?.content ?? "{}").replace(/```json\n?|\n?```/g, "").trim();
      analysis = JSON.parse(raw);
    } catch {
      analysis = {
        summary: `Competitive analysis of ${competitor.name}. Manual review recommended.`,
        newFeatures: [],
        pricingChanges: "Unknown",
        businessImpact: "Requires manual assessment",
        possibleThreat: "Unknown",
        possibleOpportunity: "Unknown",
        recommendation: "Monitor for updates",
        threatLevel: "medium",
      };
    }

    // Save report with proper FK
    const [report] = await db.insert(competitorReportsTable).values({
      competitorId: id,
      summary: analysis.summary as string ?? "",
      newFeatures: Array.isArray(analysis.newFeatures) ? analysis.newFeatures as string[] : [],
      pricingChanges: analysis.pricingChanges as string ?? null,
      businessImpact: analysis.businessImpact as string ?? null,
      possibleThreat: analysis.possibleThreat as string ?? null,
      possibleOpportunity: analysis.possibleOpportunity as string ?? null,
      recommendation: analysis.recommendation as string ?? null,
    }).returning();

    await db.update(competitorsTable).set({
      latestAnalysis: analysis.summary as string,
      lastAnalyzedAt: new Date(),
      threatLevel: analysis.threatLevel as string ?? "medium",
    }).where(eq(competitorsTable.id, id));

    res.json({ competitor: { ...competitor, latestAnalysis: analysis.summary }, report });
  } catch (err) { next(err); }
});

// ─── Reports ─────────────────────────────────────────────────────────────────

router.get("/competitors/:id/reports", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError(400, "Invalid id");

    const reports = await db.select().from(competitorReportsTable)
      .where(eq(competitorReportsTable.competitorId, id))
      .orderBy(desc(competitorReportsTable.createdAt));

    res.json(reports);
  } catch (err) { next(err); }
});

export default router;
