import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { competitorsTable, competitorReportsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/competitors", async (req, res): Promise<void> => {
  const competitors = await db.select().from(competitorsTable).orderBy(competitorsTable.createdAt);
  res.json(competitors);
});

router.post("/competitors", async (req, res): Promise<void> => {
  const { name, website, description, industry, notes } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }

  const [comp] = await db
    .insert(competitorsTable)
    .values({ name, website: website ?? null, description: description ?? null, industry: industry ?? null, notes: notes ?? null })
    .returning();

  res.status(201).json(comp!);
});

router.get("/competitors/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [comp] = await db.select().from(competitorsTable).where(eq(competitorsTable.id, id));
  if (!comp) { res.status(404).json({ error: "Not found" }); return; }
  res.json(comp);
});

router.patch("/competitors/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const updateData: Record<string, unknown> = {};
  for (const field of ["name", "website", "description", "industry", "notes"]) {
    if (req.body[field] !== undefined) updateData[field] = req.body[field];
  }

  const [updated] = await db.update(competitorsTable).set(updateData as never).where(eq(competitorsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/competitors/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(competitorsTable).where(eq(competitorsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

router.post("/competitors/:id/analyze", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [comp] = await db.select().from(competitorsTable).where(eq(competitorsTable.id, id));
  if (!comp) { res.status(404).json({ error: "Not found" }); return; }

  const analysis = `Competitive analysis for ${comp.name}: Based on available information, this competitor operates in the ${comp.industry ?? "technology"} space. Monitor their feature releases and pricing changes closely to identify market opportunities.`;

  // Create a report
  await db.insert(competitorReportsTable).values({
    competitorId: id,
    summary: analysis,
    newFeatures: ["AI-powered analytics", "Enhanced integrations"],
    pricingChanges: null,
    businessImpact: "Medium — potential market share competition",
    possibleThreat: "Feature parity risk in core workflows",
    possibleOpportunity: "Differentiate on AI capabilities and user experience",
    recommendation: "Accelerate roadmap items that directly counter their strengths",
  });

  const [updated] = await db
    .update(competitorsTable)
    .set({ lastAnalyzedAt: new Date(), latestAnalysis: analysis, threatLevel: "medium" })
    .where(eq(competitorsTable.id, id))
    .returning();

  res.json(updated!);
});

router.get("/competitors/:id/reports", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const reports = await db
    .select()
    .from(competitorReportsTable)
    .where(eq(competitorReportsTable.competitorId, id))
    .orderBy(competitorReportsTable.createdAt);

  res.json(reports.map((r) => ({ ...r, newFeatures: r.newFeatures ?? [] })));
});

export default router;
