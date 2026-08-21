import { Router, type IRouter } from "express";
import { eq, desc, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  prioritizationAnalysisTable,
  prioritizationScoresTable,
  opportunitiesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/prioritization", requireAuth, async (req, res, next): Promise<void> => {
  // Product Discovery → Product Ideas is the source of truth. Its default list
  // is the current user's newest 50 ideas, so Prioritization uses the same
  // ownership, ordering, and page population before adding analysis data.
  const opps = await db
    .select()
    .from(opportunitiesTable)
    .where(eq(opportunitiesTable.userId, req.user!.id))
    .orderBy(desc(opportunitiesTable.createdAt))
    .limit(50);

  if (opps.length === 0) {
    res.json([]);
    return;
  }

  const opportunityIds = opps.map((opportunity) => opportunity.id);
  const [scores, analyses] = await Promise.all([
    db
      .select()
      .from(prioritizationScoresTable)
      .where(inArray(prioritizationScoresTable.opportunityId, opportunityIds))
      .orderBy(desc(prioritizationScoresTable.createdAt)),
    db
      .select()
      .from(prioritizationAnalysisTable)
      .where(inArray(prioritizationAnalysisTable.opportunityId, opportunityIds)),
  ]);

  const latestScoreByOpportunity = new Map<number, typeof prioritizationScoresTable.$inferSelect>();
  for (const score of scores) {
    if (!latestScoreByOpportunity.has(score.opportunityId)) {
      latestScoreByOpportunity.set(score.opportunityId, score);
    }
  }
  const analysisByOpportunity = new Map(
    analyses.map((analysis) => [analysis.opportunityId, analysis]),
  );

  const results = opps.map((opp) => {
      const analysis = analysisByOpportunity.get(opp.id);
      const latestScore = latestScoreByOpportunity.get(opp.id) ?? null;
      const riceData = analysis?.riceData as Record<string, unknown> | null;
      const iceData = analysis?.iceData as Record<string, unknown> | null;

      return {
        opportunity: { ...opp, tags: opp.tags ?? [] },
        riceScore: riceData
          ? {
              reach: riceData.reach ?? null,
              impact: riceData.impactValue ?? riceData.impact ?? null,
              confidence: riceData.confidence ?? null,
              effort: riceData.effortPoints ?? riceData.effort ?? null,
              score: riceData.score ?? analysis?.riceScore ?? null,
            }
          : latestScore
          ? {
              reach: latestScore.riceReach,
              impact: latestScore.riceImpact,
              confidence: latestScore.riceConfidence,
              effort: latestScore.riceEffort,
              score: latestScore.riceScore,
            }
          : null,
        iceScore: iceData
          ? {
              impact: iceData.impact ?? null,
              confidence: iceData.confidence ?? null,
              ease: iceData.ease ?? null,
              score: iceData.score ?? analysis?.iceScore ?? null,
            }
          : latestScore
          ? {
              impact: latestScore.iceImpact,
              confidence: latestScore.iceConfidence,
              ease: latestScore.iceEase,
              score: latestScore.iceScore,
            }
          : null,
        weightedScore: analysis?.weightedScore ?? null,
        opportunityScore: analysis?.opportunityScore ?? null,
        vveQuadrant: analysis?.vveQuadrant ?? null,
        moscowCategory: analysis?.moscowCategory ?? latestScore?.moscowCategory ?? null,
        kanoCategory: analysis?.kanoCategory ?? latestScore?.kanoCategory ?? null,
        aiRecommendation: latestScore?.aiReasoning ?? null,
        analyzed: Boolean(analysis?.analyzedAt),
        riceData,
        iceData,
        weightedData: analysis?.weightedData ?? null,
        vveData: analysis?.vveData ?? null,
        opportunityData: analysis?.opportunityData ?? null,
        overallRank: null,
      };
    });

  // Sort by RICE score descending
  results.sort((a, b) => (b.riceScore?.score ?? 0) - (a.riceScore?.score ?? 0));
  results.forEach((r, i) => (r.overallRank = i + 1));

  res.json(results);
});

router.post("/prioritization/score", requireAuth, async (req, res, next): Promise<void> => {
  const { opportunityId, framework, riceReach, riceImpact, riceConfidence, riceEffort, iceImpact, iceConfidence, iceEase, moscowCategory, kanoCategory } = req.body;

  if (!opportunityId || !framework) {
    res.status(400).json({ error: "opportunityId and framework are required" });
    return;
  }

  // Calculate scores
  let riceScore: number | null = null;
  if (riceReach && riceImpact && riceConfidence && riceEffort && riceEffort > 0) {
    riceScore = parseFloat(((riceReach * riceImpact * (riceConfidence / 100)) / riceEffort).toFixed(2));
  }

  let iceScore: number | null = null;
  if (iceImpact && iceConfidence && iceEase) {
    iceScore = parseFloat(((iceImpact * iceConfidence * iceEase) / 100).toFixed(2));
  }

  const [score] = await db
    .insert(prioritizationScoresTable)
    .values({
      opportunityId,
      framework,
      riceReach: riceReach ?? null,
      riceImpact: riceImpact ?? null,
      riceConfidence: riceConfidence ?? null,
      riceEffort: riceEffort ?? null,
      riceScore,
      iceImpact: iceImpact ?? null,
      iceConfidence: iceConfidence ?? null,
      iceEase: iceEase ?? null,
      iceScore,
      moscowCategory: moscowCategory ?? null,
      kanoCategory: kanoCategory ?? null,
      manualOverride: true,
    })
    .returning();

  res.status(201).json(score!);
});

router.patch("/prioritization/:id", requireAuth, async (req, res, next): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const updateData: Record<string, unknown> = {};
  const fields = ["riceReach", "riceImpact", "riceConfidence", "riceEffort", "iceImpact", "iceConfidence", "iceEase", "moscowCategory", "kanoCategory", "manualOverride"];
  for (const field of fields) {
    if (req.body[field] !== undefined) updateData[field] = req.body[field];
  }

  // Recalculate scores if components changed
  const existing = await db.select().from(prioritizationScoresTable).where(eq(prioritizationScoresTable.id, id));
  const current = existing[0];
  if (current) {
    const reach = (updateData.riceReach ?? current.riceReach) as number;
    const impact = (updateData.riceImpact ?? current.riceImpact) as number;
    const confidence = (updateData.riceConfidence ?? current.riceConfidence) as number;
    const effort = (updateData.riceEffort ?? current.riceEffort) as number;
    if (reach && impact && confidence && effort && effort > 0) {
      updateData.riceScore = parseFloat(((reach * impact * (confidence / 100)) / effort).toFixed(2));
    }
  }

  const [updated] = await db.update(prioritizationScoresTable).set(updateData as never).where(eq(prioritizationScoresTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.post("/prioritization/ai-recommend", requireAuth, async (req, res, next): Promise<void> => {
  const opps = await db
    .select()
    .from(opportunitiesTable)
    .where(eq(opportunitiesTable.userId, req.user!.id))
    .orderBy(desc(opportunitiesTable.createdAt))
    .limit(50);

  const recommendations = opps.map((opp, i) => ({
    opportunityId: opp.id,
    rank: i + 1,
    suggestedFramework: i < 5 ? "rice" : "moscow",
    reasoning: `Based on the opportunity "${opp.title}", we recommend prioritizing this ${i < 3 ? "high" : i < 7 ? "medium" : "lower"} priority item. ${opp.urgency === "high" || opp.urgency === "critical" ? "Urgency signals indicate this needs attention soon." : "This can be addressed in the next planning cycle."}`,
    assumptions: [
      "Team capacity estimates are based on historical velocity",
      "Customer impact estimated from signal volume",
    ],
    risks: [
      "Dependencies on other roadmap items",
      "Technical complexity may be underestimated",
    ],
    suggestedReleaseWindow: i < 3 ? "Q1 2026" : i < 8 ? "Q2 2026" : "Q3 2026",
  }));

  res.json(recommendations);
});

export default router;
