import { Router, type IRouter } from "express";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  prioritizationScoresTable,
  prioritizationAnalysisTable,
  opportunitiesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Recompute all formula scores from AI-provided inputs (guarantees spec correctness). */
function computeScores(data: Record<string, any>) {
  // RICE = (Reach × ImpactValue × Confidence%) / Effort(SP)
  if (data.riceData) {
    const r = data.riceData;
    const effort = Math.max(r.effortPoints ?? 1, 1);
    r.score = parseFloat(((r.reach * r.impactValue * ((r.confidence ?? 50) / 100)) / effort).toFixed(2));
  }
  // ICE = Impact × Confidence × Ease  (all 1–10)
  if (data.iceData) {
    const d = data.iceData;
    d.score = parseFloat(((d.impact ?? 5) * (d.confidence ?? 5) * (d.ease ?? 5)).toFixed(2));
  }
  // Weighted Score
  if (data.weightedData) {
    const w = data.weightedData;
    w.score = parseFloat((
      (w.customerValue    ?? 5) * 0.25 +
      (w.revenueImpact    ?? 5) * 0.20 +
      (w.strategicAlignment ?? 5) * 0.20 +
      (w.technicalComplexity ?? 5) * 0.15 +
      (w.competitiveAdvantage ?? 5) * 0.10 +
      (w.risk             ?? 5) * 0.10
    ).toFixed(2));
  }
  // Opportunity Score = Importance + (Importance − Satisfaction)
  if (data.opportunityData) {
    const o = data.opportunityData;
    o.score = parseFloat(((o.importance ?? 5) + ((o.importance ?? 5) - (o.satisfaction ?? 5))).toFixed(2));
  }
  // VVE quadrant
  if (data.vveData) {
    const v = data.vveData;
    const highValue  = (v.businessValue    ?? 5) >= 6;
    const highEffort = (v.engineeringEffort ?? 5) >= 6;
    v.quadrant = highValue
      ? (highEffort ? "high_value_high_effort" : "high_value_low_effort")
      : (highEffort ? "low_value_high_effort"  : "low_value_low_effort");
  }
  // Engineering totals
  if (data.engineeringData) {
    const e = data.engineeringData;
    e.totalStoryPoints = (e.frontend ?? 0) + (e.backend ?? 0) + (e.database ?? 0) + (e.api ?? 0) + (e.ai ?? 0) + (e.qa ?? 0);
    e.estimatedDays    = Math.ceil(e.totalStoryPoints * 0.8); // 1 SP ≈ 0.8 days
    e.sprintCount      = Math.ceil(e.totalStoryPoints / 20);  // 20 SP / 2-week sprint
  }
}

function buildFallbackAnalysis(opp: typeof opportunitiesTable.$inferSelect) {
  const urgencyEffort: Record<string, number> = { critical: 8, high: 13, medium: 21, low: 34 };
  const effort = urgencyEffort[opp.urgency ?? "medium"] ?? 21;
  const confidence = opp.confidenceScore ?? 50;
  return {
    riceData:        { reach: 500, impactLabel: "Medium", impactValue: 1, confidence, effortPoints: effort, explanation: "Estimated from available signals." },
    iceData:         { impact: 5, confidence: Math.round(confidence / 10), ease: 5, explanation: "Default mid-range estimate." },
    moscowData:      { category: "should_have", explanation: "Insufficient data for precise classification." },
    weightedData:    { customerValue: 5, revenueImpact: 5, strategicAlignment: 5, technicalComplexity: 5, competitiveAdvantage: 5, risk: 5, explanation: "Default mid-range estimate." },
    vveData:         { businessValue: 5, engineeringEffort: 5, explanation: "Requires further analysis." },
    kanoData:        { category: "performance", explanation: "Estimated based on available data." },
    opportunityData: { importance: 6, satisfaction: 4, explanation: "Estimated from urgency signals." },
    engineeringData: { frontend: 5, backend: 8, database: 3, api: 3, ai: 2, qa: 5, complexity: "Medium", confidence: 50 },
    businessContext:  { customerCount: 50, enterpriseCount: 10, smbCount: 30, arrImpact: 5, revenueOpportunity: "Medium", retentionImpact: 5, customerReach: 5, competitiveAdvantage: 5, aiConfidence: 40 },
    executiveData:   { score: 50, confidence: 40, whyBuildNext: "Moderate priority based on available signals. Recommend full analysis.", businessImpact: "Medium potential impact.", customerImpact: "Addresses a segment of customer needs.", engineering: "Medium-complexity implementation.", risks: "Incomplete information may affect estimates.", expectedROI: "Moderate return expected." },
  };
}

// ─── Existing endpoints (unchanged) ───────────────────────────────────────────

router.get("/prioritization", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const { framework } = req.query as Record<string, string>;
    const opps = await db.select().from(opportunitiesTable).orderBy(opportunitiesTable.createdAt);

    const results = await Promise.all(
      opps.map(async (opp) => {
        const scores = framework
          ? await db.select().from(prioritizationScoresTable)
              .where(eq(prioritizationScoresTable.opportunityId, opp.id))
          : await db.select().from(prioritizationScoresTable)
              .where(eq(prioritizationScoresTable.opportunityId, opp.id));

        const latestScore = scores[scores.length - 1] ?? null;

        // Also load the full analysis if available
        const [analysis] = await db.select().from(prioritizationAnalysisTable)
          .where(eq(prioritizationAnalysisTable.opportunityId, opp.id));

        return {
          opportunity: { ...opp, tags: opp.tags ?? [] },
          riceScore: analysis?.riceData
            ? (analysis.riceData as any)
            : latestScore
              ? { reach: latestScore.riceReach, impact: latestScore.riceImpact, confidence: latestScore.riceConfidence, effort: latestScore.riceEffort, score: latestScore.riceScore }
              : null,
          iceScore: analysis?.iceData
            ? (analysis.iceData as any)
            : latestScore
              ? { impact: latestScore.iceImpact, confidence: latestScore.iceConfidence, ease: latestScore.iceEase, score: latestScore.iceScore }
              : null,
          moscowCategory: analysis?.moscowCategory ?? latestScore?.moscowCategory ?? null,
          kanoCategory:   analysis?.kanoCategory   ?? latestScore?.kanoCategory   ?? null,
          weightedScore:  analysis?.weightedScore  ?? null,
          opportunityScore: analysis?.opportunityScore ?? null,
          vveQuadrant:    analysis?.vveQuadrant    ?? null,
          aiRecommendation: (analysis?.executiveData as any)?.whyBuildNext ?? latestScore?.aiReasoning ?? null,
          analyzed: !!analysis?.analyzedAt,
          overallRank: null as number | null,
        };
      })
    );

    results.sort((a, b) => (b.riceScore?.score ?? 0) - (a.riceScore?.score ?? 0));
    results.forEach((r, i) => (r.overallRank = i + 1));

    res.json(results);
  } catch (err) { next(err); }
});

router.post("/prioritization/score", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const { opportunityId, framework, riceReach, riceImpact, riceConfidence, riceEffort, iceImpact, iceConfidence, iceEase, moscowCategory, kanoCategory } = req.body;
    if (!opportunityId || !framework) { res.status(400).json({ error: "opportunityId and framework are required" }); return; }

    let riceScore: number | null = null;
    if (riceReach && riceImpact && riceConfidence && riceEffort && riceEffort > 0) {
      riceScore = parseFloat(((riceReach * riceImpact * (riceConfidence / 100)) / riceEffort).toFixed(2));
    }
    let iceScore: number | null = null;
    if (iceImpact && iceConfidence && iceEase) {
      iceScore = parseFloat(((iceImpact * iceConfidence * iceEase)).toFixed(2));
    }

    const [score] = await db.insert(prioritizationScoresTable).values({
      opportunityId, framework,
      riceReach: riceReach ?? null, riceImpact: riceImpact ?? null, riceConfidence: riceConfidence ?? null, riceEffort: riceEffort ?? null, riceScore,
      iceImpact: iceImpact ?? null, iceConfidence: iceConfidence ?? null, iceEase: iceEase ?? null, iceScore,
      moscowCategory: moscowCategory ?? null, kanoCategory: kanoCategory ?? null, manualOverride: true,
    }).returning();
    res.status(201).json(score!);
  } catch (err) { next(err); }
});

router.patch("/prioritization/:id", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const updateData: Record<string, unknown> = {};
    for (const field of ["riceReach","riceImpact","riceConfidence","riceEffort","iceImpact","iceConfidence","iceEase","moscowCategory","kanoCategory","manualOverride"]) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    const [current] = await db.select().from(prioritizationScoresTable).where(eq(prioritizationScoresTable.id, id));
    if (current) {
      const reach = (updateData.riceReach ?? current.riceReach) as number;
      const impact = (updateData.riceImpact ?? current.riceImpact) as number;
      const conf   = (updateData.riceConfidence ?? current.riceConfidence) as number;
      const effort = (updateData.riceEffort ?? current.riceEffort) as number;
      if (reach && impact && conf && effort && effort > 0) {
        updateData.riceScore = parseFloat(((reach * impact * (conf / 100)) / effort).toFixed(2));
      }
    }

    const [updated] = await db.update(prioritizationScoresTable).set(updateData as never).where(eq(prioritizationScoresTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) { next(err); }
});

router.post("/prioritization/ai-recommend", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const opps = await db.select().from(opportunitiesTable).orderBy(opportunitiesTable.createdAt).limit(20);
    const recommendations = opps.map((opp, i) => ({
      opportunityId: opp.id,
      rank: i + 1,
      suggestedFramework: i < 5 ? "rice" : "moscow",
      reasoning: `Based on "${opp.title}", this is a ${i < 3 ? "high" : i < 7 ? "medium" : "lower"} priority item.${opp.urgency === "high" || opp.urgency === "critical" ? " Urgency signals indicate this needs attention soon." : ""}`,
      assumptions: ["Team capacity based on historical velocity", "Customer impact estimated from signal volume"],
      risks: ["Dependencies on other roadmap items", "Technical complexity may be underestimated"],
      suggestedReleaseWindow: i < 3 ? "Q1 2026" : i < 8 ? "Q2 2026" : "Q3 2026",
    }));
    res.json(recommendations);
  } catch (err) { next(err); }
});

// ─── NEW: Full AI analysis for one opportunity ────────────────────────────────

router.post("/prioritization/analyze/:opportunityId", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const oppId = parseInt(req.params.opportunityId as string, 10);
    if (isNaN(oppId)) { res.status(400).json({ error: "Invalid opportunityId" }); return; }

    const [opp] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, oppId));
    if (!opp) { res.status(404).json({ error: "Opportunity not found" }); return; }

    // ── Single AI call — ask for inputs only, server computes formulas ─────────
    let aiData: Record<string, any> = buildFallbackAnalysis(opp);

    try {
      const { openai } = await import("@workspace/integrations-openai-ai-server");
      const response = await openai.chat.completions.create({
        model: "gpt-5.6-luna",
        max_completion_tokens: 1600,
        messages: [{
          role: "user",
          content: `You are a product prioritization expert. Analyze this product idea and return ONLY a JSON object with no markdown.

Title: "${opp.title}"
Description: ${(opp.description ?? "").substring(0, 250)}
Business Value: ${(opp.businessValue ?? "").substring(0, 120)}
Customer Value: ${(opp.customerValue ?? "").substring(0, 120)}
Urgency: ${opp.urgency ?? "medium"}
Confidence: ${opp.confidenceScore ?? 50}%

Return exactly this structure (keep all string values under 120 chars):
{
  "riceData": { "reach": <int: customers benefiting>, "impactLabel": <"Massive"|"High"|"Medium"|"Low"|"Minimal">, "impactValue": <3|2|1|0.5|0.25>, "confidence": <0-100>, "effortPoints": <story points int>, "explanation": <string> },
  "iceData": { "impact": <1-10>, "confidence": <1-10>, "ease": <1-10>, "explanation": <string> },
  "moscowData": { "category": <"must_have"|"should_have"|"could_have"|"wont_have">, "explanation": <string> },
  "weightedData": { "customerValue": <1-10>, "revenueImpact": <1-10>, "strategicAlignment": <1-10>, "technicalComplexity": <1-10>, "competitiveAdvantage": <1-10>, "risk": <1-10>, "explanation": <string> },
  "vveData": { "businessValue": <1-10>, "engineeringEffort": <1-10>, "explanation": <string> },
  "kanoData": { "category": <"basic"|"performance"|"excitement"|"indifferent"|"reverse">, "explanation": <string> },
  "opportunityData": { "importance": <1-10>, "satisfaction": <1-10>, "explanation": <string> },
  "engineeringData": { "frontend": <sp>, "backend": <sp>, "database": <sp>, "api": <sp>, "ai": <sp>, "qa": <sp>, "complexity": <"Low"|"Medium"|"High">, "confidence": <0-100> },
  "businessContext": { "customerCount": <int>, "enterpriseCount": <int>, "smbCount": <int>, "arrImpact": <1-10>, "revenueOpportunity": <"Low"|"Medium"|"High">, "retentionImpact": <1-10>, "customerReach": <1-10>, "competitiveAdvantage": <1-10>, "aiConfidence": <0-100> },
  "executiveData": { "score": <0-100>, "confidence": <0-100>, "whyBuildNext": <string>, "businessImpact": <string>, "customerImpact": <string>, "engineering": <string>, "risks": <string>, "expectedROI": <string> }
}`,
        }],
      });
      const raw = response.choices[0]?.message?.content ?? "{}";
      aiData = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
    } catch { /* use fallback */ }

    // ── Server-side formula computation (always correct per spec) ─────────────
    computeScores(aiData);

    // ── Upsert analysis row ───────────────────────────────────────────────────
    const values = {
      opportunityId:   oppId,
      riceScore:       (aiData.riceData as any)?.score ?? null,
      iceScore:        (aiData.iceData as any)?.score ?? null,
      weightedScore:   (aiData.weightedData as any)?.score ?? null,
      opportunityScore:(aiData.opportunityData as any)?.score ?? null,
      moscowCategory:  (aiData.moscowData as any)?.category ?? null,
      kanoCategory:    (aiData.kanoData as any)?.category ?? null,
      vveQuadrant:     (aiData.vveData as any)?.quadrant ?? null,
      riceData:        aiData.riceData ?? null,
      iceData:         aiData.iceData ?? null,
      moscowData:      aiData.moscowData ?? null,
      weightedData:    aiData.weightedData ?? null,
      vveData:         aiData.vveData ?? null,
      kanoData:        aiData.kanoData ?? null,
      opportunityData: aiData.opportunityData ?? null,
      engineeringData: aiData.engineeringData ?? null,
      businessContext: aiData.businessContext ?? null,
      executiveData:   aiData.executiveData ?? null,
      analyzedAt:      new Date(),
    };

    const [existing] = await db.select({ id: prioritizationAnalysisTable.id })
      .from(prioritizationAnalysisTable)
      .where(eq(prioritizationAnalysisTable.opportunityId, oppId));

    let analysis;
    if (existing) {
      [analysis] = await db.update(prioritizationAnalysisTable)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(prioritizationAnalysisTable.id, existing.id))
        .returning();
    } else {
      [analysis] = await db.insert(prioritizationAnalysisTable).values(values).returning();
    }

    res.json({ opportunity: { ...opp, tags: opp.tags ?? [] }, analysis });
  } catch (err) { next(err); }
});

// ─── NEW: Executive recommendation (reads stored analyses, no extra AI call) ──

router.get("/prioritization/executive-recommendation", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const analyses = await db.select().from(prioritizationAnalysisTable)
      .where(isNotNull(prioritizationAnalysisTable.analyzedAt));
    const opps = await db.select().from(opportunitiesTable);
    const oppMap = Object.fromEntries(opps.map((o) => [o.id, o]));

    const ranked = analyses
      .map((a) => ({
        opportunity: oppMap[a.opportunityId] ? { ...oppMap[a.opportunityId]!, tags: oppMap[a.opportunityId]!.tags ?? [] } : null,
        analysis: a,
        execScore: ((a.executiveData as any)?.score ?? 0) as number,
      }))
      .filter((r) => r.opportunity !== null)
      .sort((a, b) => b.execScore - a.execScore);

    res.json({
      topRecommendation: ranked[0] ?? null,
      allRanked: ranked,
      totalAnalyzed: ranked.length,
    });
  } catch (err) { next(err); }
});

// ─── NEW: Feature comparison (one AI call per request) ───────────────────────

router.post("/prioritization/compare", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const { idA, idB } = req.body as { idA: number; idB: number };
    if (!idA || !idB) { res.status(400).json({ error: "idA and idB are required" }); return; }

    const [[oppA], [oppB], [analysisA], [analysisB]] = await Promise.all([
      db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, idA)),
      db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, idB)),
      db.select().from(prioritizationAnalysisTable).where(eq(prioritizationAnalysisTable.opportunityId, idA)),
      db.select().from(prioritizationAnalysisTable).where(eq(prioritizationAnalysisTable.opportunityId, idB)),
    ]);

    if (!oppA || !oppB) { res.status(404).json({ error: "One or both opportunities not found" }); return; }

    // Lean summary for the AI prompt (avoids sending full JSONB blobs)
    const summarise = (opp: typeof oppA, analysis: typeof analysisA | undefined) => ({
      title: opp.title,
      urgency: opp.urgency,
      riceScore: analysis?.riceScore,
      iceScore: analysis?.iceScore,
      weightedScore: analysis?.weightedScore,
      opportunityScore: analysis?.opportunityScore,
      moscowCategory: analysis?.moscowCategory,
      kanoCategory: analysis?.kanoCategory,
      vveQuadrant: analysis?.vveQuadrant,
      executiveScore: (analysis?.executiveData as any)?.score,
      engineering: analysis?.engineeringData ? {
        totalSP: (analysis.engineeringData as any).totalStoryPoints,
        complexity: (analysis.engineeringData as any).complexity,
      } : null,
    });

    let aiInsight = {
      winner: oppA.title,
      reason: "Both features have not been fully analyzed. Run AI Analysis on each to enable comparison.",
      risks: ["Missing analysis data"] as string[],
      tradeoffs: ["Cannot compare without scores"] as string[],
      recommendation: "Analyze both features first, then compare.",
    };

    try {
      const { openai } = await import("@workspace/integrations-openai-ai-server");
      const response = await openai.chat.completions.create({
        model: "gpt-5.6-luna",
        max_completion_tokens: 600,
        messages: [{
          role: "user",
          content: `Compare these two product ideas and return ONLY a JSON object (no markdown):

Feature A: ${JSON.stringify(summarise(oppA, analysisA))}
Feature B: ${JSON.stringify(summarise(oppB, analysisB))}

Return: { "winner": <"A" title|"B" title>, "reason": <string>, "risks": [<string>], "tradeoffs": [<string>], "recommendation": <string> }`,
        }],
      });
      const raw = response.choices[0]?.message?.content ?? "{}";
      aiInsight = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
    } catch { /* use default insight */ }

    res.json({
      opportunityA: { ...oppA, tags: oppA.tags ?? [] },
      opportunityB: { ...oppB, tags: oppB.tags ?? [] },
      analysisA: analysisA ?? null,
      analysisB: analysisB ?? null,
      aiInsight,
    });
  } catch (err) { next(err); }
});

export default router;
