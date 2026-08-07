import { Router, type IRouter } from "express";
import { eq, ilike, and, SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  opportunitiesTable,
  signalsTable,
  feedbackTable,
  meetingsTable,
} from "@workspace/db";

const router: IRouter = Router();

router.get("/opportunities", async (req, res): Promise<void> => {
  const { status, category, source_type, sentiment, search } = req.query as Record<string, string>;

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(opportunitiesTable.status, status));
  if (category) conditions.push(eq(opportunitiesTable.category, category));
  if (source_type) conditions.push(eq(opportunitiesTable.sourceType, source_type));
  if (sentiment) conditions.push(eq(opportunitiesTable.sentiment, sentiment));
  if (search) conditions.push(ilike(opportunitiesTable.title, `%${search}%`));

  const opps =
    conditions.length > 0
      ? await db
          .select()
          .from(opportunitiesTable)
          .where(and(...conditions))
          .orderBy(opportunitiesTable.createdAt)
      : await db.select().from(opportunitiesTable).orderBy(opportunitiesTable.createdAt);

  res.json(
    opps.map((o) => ({
      ...o,
      tags: o.tags ?? [],
    }))
  );
});

router.post("/opportunities", async (req, res): Promise<void> => {
  const { title, description, sourceType, category, originalContent, customerProblem, suggestedSolution, businessValue, urgency, tags, status } = req.body;

  if (!title || !description) {
    res.status(400).json({ error: "title and description are required" });
    return;
  }

  const [opp] = await db
    .insert(opportunitiesTable)
    .values({
      title,
      description,
      sourceType: sourceType ?? "manual",
      category: category ?? null,
      originalContent: originalContent ?? null,
      customerProblem: customerProblem ?? null,
      suggestedSolution: suggestedSolution ?? null,
      businessValue: businessValue ?? null,
      urgency: urgency ?? null,
      tags: tags ?? [],
      status: status ?? "new",
    })
    .returning();

  res.status(201).json({ ...opp!, tags: opp!.tags ?? [] });
});

router.get("/opportunities/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [opp] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id));
  if (!opp) { res.status(404).json({ error: "Not found" }); return; }

  // Build evidence panel
  const signalCount = await db.select().from(signalsTable).where(eq(signalsTable.opportunityId, String(id)));
  const feedbackCount = await db.select().from(feedbackTable).where(eq(feedbackTable.opportunityId, String(id)));

  const evidence = {
    customerRequestCount: signalCount.length,
    stakeholderMentions: feedbackCount.length,
    meetingMentions: 0,
    competitorReferences: 0,
    socialMentions: signalCount.filter((s) => s.sourceType === "social_media").length,
    exampleQuotes: signalCount.slice(0, 3).map((s) => s.content.substring(0, 150)),
    sourceLinks: signalCount.filter((s) => s.sourceUrl).map((s) => s.sourceUrl!),
  };

  res.json({
    ...opp,
    tags: opp.tags ?? [],
    evidence,
    relatedSignals: signalCount.map((s) => ({
      ...s,
      opportunityId: s.opportunityId ? parseInt(s.opportunityId, 10) : null,
    })),
  });
});

router.patch("/opportunities/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const updateData: Record<string, unknown> = {};
  const fields = ["title", "description", "category", "sourceType", "customerProblem", "suggestedSolution", "businessValue", "urgency", "tags", "status"];
  for (const field of fields) {
    if (req.body[field] !== undefined) updateData[field] = req.body[field];
  }

  const [updated] = await db
    .update(opportunitiesTable)
    .set(updateData as never)
    .where(eq(opportunitiesTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...updated, tags: updated.tags ?? [] });
});

router.delete("/opportunities/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(opportunitiesTable).where(eq(opportunitiesTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

router.post("/opportunities/:id/analyze", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [opp] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id));
  if (!opp) { res.status(404).json({ error: "Not found" }); return; }

  const { openai } = await import("@workspace/integrations-openai-ai-server");

  const prompt = `Analyze this product opportunity and return a JSON object with these fields:
- summary (string): 2-3 sentence executive summary of the opportunity
- sentiment (string): one of "positive", "negative", "neutral", "mixed"
- urgency (string): one of "low", "medium", "high", "critical"
- category (string): one of "feature_request", "bug", "improvement", "pain_point", "market_opportunity", "integration"
- confidenceScore (number 0-1): how confident you are in this analysis
- estimatedCustomerImpact (string): brief assessment of customer impact
- estimatedBusinessImpact (string): brief assessment of business/revenue impact

Opportunity Title: ${opp.title}
Description: ${opp.description}
Source Type: ${opp.sourceType}
Original Content: ${opp.originalContent ?? "N/A"}
Customer Problem: ${opp.customerProblem ?? "N/A"}

Return only valid JSON, no markdown.`;

  let aiResult: Record<string, unknown> = {};
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = response.choices[0]?.message?.content ?? "{}";
    aiResult = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
  } catch {
    aiResult = {
      summary: `${opp.title} represents a product opportunity requiring further analysis.`,
      sentiment: "neutral",
      urgency: "medium",
      category: opp.category ?? "feature_request",
      confidenceScore: 0.5,
      estimatedCustomerImpact: "To be assessed",
      estimatedBusinessImpact: "To be assessed",
    };
  }

  const [updated] = await db
    .update(opportunitiesTable)
    .set({
      aiSummary: aiResult.summary as string,
      sentiment: aiResult.sentiment as string,
      urgency: aiResult.urgency as string,
      category: aiResult.category as string,
      confidenceScore: aiResult.confidenceScore as number,
      estimatedCustomerImpact: aiResult.estimatedCustomerImpact as string,
      estimatedBusinessImpact: aiResult.estimatedBusinessImpact as string,
    })
    .where(eq(opportunitiesTable.id, id))
    .returning();

  res.json({ ...updated!, tags: updated!.tags ?? [] });
});

export default router;
