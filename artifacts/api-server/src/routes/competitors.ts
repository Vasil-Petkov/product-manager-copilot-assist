import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { competitorsTable, competitorReportsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/competitors", async (req, res): Promise<void> => {
  const competitors = await db.select().from(competitorsTable).orderBy(desc(competitorsTable.createdAt));
  res.json(competitors);
});

router.post("/competitors", async (req, res): Promise<void> => {
  const { name, website, description, industry, notes } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const [comp] = await db
    .insert(competitorsTable)
    .values({
      name: name.trim(),
      website: website ?? null,
      description: description ?? null,
      industry: industry ?? null,
      notes: notes ?? null,
    })
    .returning();

  res.status(201).json(comp!);
});

router.get("/competitors/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [comp] = await db.select().from(competitorsTable).where(eq(competitorsTable.id, id));
  if (!comp) { res.status(404).json({ error: "Not found" }); return; }
  res.json(comp);
});

router.patch("/competitors/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const updateData: Record<string, unknown> = {};
  for (const field of ["name", "website", "description", "industry", "notes", "threatLevel"]) {
    if (req.body[field] !== undefined) updateData[field] = req.body[field];
  }

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(competitorsTable)
    .set(updateData as never)
    .where(eq(competitorsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/competitors/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(competitorsTable).where(eq(competitorsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

router.post("/competitors/:id/analyze", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [comp] = await db.select().from(competitorsTable).where(eq(competitorsTable.id, id));
  if (!comp) { res.status(404).json({ error: "Not found" }); return; }

  let reportData = {
    summary: "",
    newFeatures: [] as string[],
    pricingChanges: null as string | null,
    businessImpact: "",
    possibleThreat: "",
    possibleOpportunity: "",
    recommendation: "",
    threatLevel: "medium" as string,
  };

  try {
    const { openai } = await import("@workspace/integrations-openai-ai-server");

    const prompt = `You are a product strategy analyst. Analyze this competitor and produce a structured competitive intelligence report.

Competitor: ${comp.name}
Website: ${comp.website ?? "Unknown"}
Industry: ${comp.industry ?? "Technology / SaaS"}
Description: ${comp.description ?? "Not provided"}
Our notes: ${comp.notes ?? "None"}

Return a JSON object with:
- summary (string): 2-3 sentence overview of this competitor's position and recent direction
- newFeatures (string[]): likely recent features or product investments (2-4 items based on company type)
- pricingChanges (string | null): any pricing dynamics or model observations
- businessImpact (string): how this competitor impacts our business (one sentence)
- possibleThreat (string): primary threat they pose (one sentence)
- possibleOpportunity (string): differentiation opportunity we have vs them (one sentence)
- recommendation (string): one concrete strategic recommendation for our product team
- threatLevel (string): one of "low", "medium", "high"

Return only valid JSON, no markdown.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (response.choices[0]?.message?.content ?? "{}").replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(raw);

    reportData = {
      summary: parsed.summary ?? `Competitive analysis for ${comp.name}.`,
      newFeatures: Array.isArray(parsed.newFeatures) ? parsed.newFeatures : [],
      pricingChanges: parsed.pricingChanges ?? null,
      businessImpact: parsed.businessImpact ?? "Monitor closely for market impact.",
      possibleThreat: parsed.possibleThreat ?? "Feature parity risk.",
      possibleOpportunity: parsed.possibleOpportunity ?? "Differentiate on user experience.",
      recommendation: parsed.recommendation ?? "Accelerate roadmap items that counter their strengths.",
      threatLevel: ["low", "medium", "high"].includes(parsed.threatLevel) ? parsed.threatLevel : "medium",
    };
  } catch {
    reportData.summary = `${comp.name} is a ${comp.industry ?? "technology"} competitor. Manual review recommended to assess their product trajectory and pricing.`;
    reportData.recommendation = "Research their recent releases and pricing page, then update this analysis.";
  }

  // Insert the new report
  await db.insert(competitorReportsTable).values({
    competitorId: id,
    summary: reportData.summary,
    newFeatures: reportData.newFeatures,
    pricingChanges: reportData.pricingChanges,
    businessImpact: reportData.businessImpact,
    possibleThreat: reportData.possibleThreat,
    possibleOpportunity: reportData.possibleOpportunity,
    recommendation: reportData.recommendation,
  });

  // Update competitor record
  const [updated] = await db
    .update(competitorsTable)
    .set({
      lastAnalyzedAt: new Date(),
      latestAnalysis: reportData.summary,
      threatLevel: reportData.threatLevel,
    })
    .where(eq(competitorsTable.id, id))
    .returning();

  res.json(updated!);
});

router.get("/competitors/:id/reports", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const reports = await db
    .select()
    .from(competitorReportsTable)
    .where(eq(competitorReportsTable.competitorId, id))
    .orderBy(desc(competitorReportsTable.createdAt));

  res.json(reports.map((r) => ({ ...r, newFeatures: r.newFeatures ?? [] })));
});

export default router;
