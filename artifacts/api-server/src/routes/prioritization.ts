import { Router, type IRouter } from "express";
import { eq, and, SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { prioritizationScoresTable, opportunitiesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/prioritization", async (req, res): Promise<void> => {
  const { framework } = req.query as Record<string, string>;

  const opps = await db.select().from(opportunitiesTable).orderBy(opportunitiesTable.createdAt);

  const results = await Promise.all(
    opps.map(async (opp) => {
      const scores = framework
        ? await db
            .select()
            .from(prioritizationScoresTable)
            .where(and(eq(prioritizationScoresTable.opportunityId, opp.id), eq(prioritizationScoresTable.framework, framework)))
        : await db.select().from(prioritizationScoresTable).where(eq(prioritizationScoresTable.opportunityId, opp.id));

      const latestScore = scores[scores.length - 1] ?? null;

      return {
        opportunity: { ...opp, tags: opp.tags ?? [] },
        riceScore: latestScore
          ? {
              reach: latestScore.riceReach,
              impact: latestScore.riceImpact,
              confidence: latestScore.riceConfidence,
              effort: latestScore.riceEffort,
              score: latestScore.riceScore,
            }
          : null,
        iceScore: latestScore
          ? {
              impact: latestScore.iceImpact,
              confidence: latestScore.iceConfidence,
              ease: latestScore.iceEase,
              score: latestScore.iceScore,
            }
          : null,
        moscowCategory: latestScore?.moscowCategory ?? null,
        kanoCategory: latestScore?.kanoCategory ?? null,
        aiRecommendation: latestScore?.aiReasoning ?? null,
        overallRank: null,
      };
    })
  );

  // Sort by RICE score descending
  results.sort((a, b) => (b.riceScore?.score ?? 0) - (a.riceScore?.score ?? 0));
  results.forEach((r, i) => (r.overallRank = i + 1));

  res.json(results);
});

router.post("/prioritization/score", async (req, res): Promise<void> => {
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

router.patch("/prioritization/:id", async (req, res): Promise<void> => {
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

router.post("/prioritization/ai-recommend", async (req, res): Promise<void> => {
  const opps = await db.select().from(opportunitiesTable).orderBy(opportunitiesTable.createdAt).limit(20);

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
