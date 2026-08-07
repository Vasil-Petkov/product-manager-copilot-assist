import { Router, type IRouter } from "express";
import { eq, ilike, and, desc, SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { opportunitiesTable, signalsTable, feedbackTable } from "@workspace/db";
import { recordTimeline } from "./product-ideas";

const router: IRouter = Router();

router.get("/opportunities", async (req, res): Promise<void> => {
  const { status, category, source_type, sentiment, search } = req.query as Record<string, string>;

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(opportunitiesTable.status, status));
  if (category) conditions.push(eq(opportunitiesTable.category, category));
  if (source_type) conditions.push(eq(opportunitiesTable.sourceType, source_type));
  if (sentiment) conditions.push(eq(opportunitiesTable.sentiment, sentiment));
  if (search) conditions.push(ilike(opportunitiesTable.title, `%${search}%`));

  const opps = conditions.length > 0
    ? await db.select().from(opportunitiesTable).where(and(...conditions)).orderBy(desc(opportunitiesTable.createdAt))
    : await db.select().from(opportunitiesTable).orderBy(desc(opportunitiesTable.createdAt));

  res.json(opps.map((o) => ({ ...o, tags: o.tags ?? [] })));
});

router.post("/opportunities", async (req, res): Promise<void> => {
  const { title, description, sourceType, category, originalContent, customerProblem, suggestedSolution, businessValue, urgency, tags, status } = req.body;

  if (!title || !title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (!description || !description.trim()) {
    res.status(400).json({ error: "description is required" });
    return;
  }

  const [opp] = await db
    .insert(opportunitiesTable)
    .values({
      title: title.trim(),
      description: description.trim(),
      sourceType: sourceType ?? "manual",
      category: category ?? null,
      originalContent: originalContent ?? null,
      customerProblem: customerProblem ?? null,
      suggestedSolution: suggestedSolution ?? null,
      businessValue: businessValue ?? null,
      urgency: urgency ?? null,
      tags: Array.isArray(tags) ? tags : [],
      status: status ?? "new",
    })
    .returning();

  // Record timeline event
  await recordTimeline(opp!.id, "created", `Product Idea created from ${sourceType ?? "manual"} source`);

  res.status(201).json({ ...opp!, tags: opp!.tags ?? [] });
});

router.get("/opportunities/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [opp] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id));
  if (!opp) { res.status(404).json({ error: "Not found" }); return; }

  const [relatedSignals, relatedFeedback] = await Promise.all([
    db.select().from(signalsTable).where(eq(signalsTable.opportunityId, String(id))),
    db.select().from(feedbackTable).where(eq(feedbackTable.opportunityId, String(id))),
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
    relatedSignals: relatedSignals.map((s) => ({
      ...s,
      opportunityId: s.opportunityId ? parseInt(s.opportunityId, 10) : null,
    })),
  });
});

router.patch("/opportunities/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const fields = [
    "title", "description", "category", "sourceType", "originalContent",
    "customerProblem", "suggestedSolution", "businessValue", "urgency",
    "tags", "status", "aiSummary", "sentiment", "confidenceScore",
    "estimatedCustomerImpact", "estimatedBusinessImpact",
  ];

  const updateData: Record<string, unknown> = {};
  for (const field of fields) {
    if (req.body[field] !== undefined) updateData[field] = req.body[field];
  }

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
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
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(opportunitiesTable).where(eq(opportunitiesTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

router.post("/opportunities/:id/analyze", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [opp] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id));
  if (!opp) { res.status(404).json({ error: "Not found" }); return; }

  let aiResult: Record<string, unknown> = {};
  try {
    const { openai } = await import("@workspace/integrations-openai-ai-server");

    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 1024,
      messages: [{
        role: "user",
        content: `Analyze this product opportunity and return a JSON object with:
- summary (string): 2-3 sentence executive summary
- sentiment (string): one of "positive", "negative", "neutral", "mixed"
- urgency (string): one of "low", "medium", "high", "critical"
- category (string): one of "feature_request", "bug", "improvement", "pain_point", "market_opportunity", "integration"
- confidenceScore (number 0-1): confidence in this analysis
- estimatedCustomerImpact (string): brief customer impact assessment
- estimatedBusinessImpact (string): brief business/revenue impact assessment

Title: ${opp.title}
Description: ${opp.description}
Source: ${opp.sourceType}
Customer Problem: ${opp.customerProblem ?? "N/A"}
Original Content: ${opp.originalContent ?? "N/A"}

Return only valid JSON, no markdown.`,
      }],
    });

    const raw = (response.choices[0]?.message?.content ?? "{}").replace(/```json\n?|\n?```/g, "").trim();
    aiResult = JSON.parse(raw);
  } catch {
    aiResult = {
      summary: `${opp.title} is a product opportunity requiring attention. Review the description and customer context for full assessment.`,
      sentiment: opp.sentiment ?? "neutral",
      urgency: opp.urgency ?? "medium",
      category: opp.category ?? "feature_request",
      confidenceScore: 0.5,
      estimatedCustomerImpact: "To be assessed",
      estimatedBusinessImpact: "To be assessed",
    };
  }

  const [updated] = await db
    .update(opportunitiesTable)
    .set({
      aiSummary: typeof aiResult.summary === "string" ? aiResult.summary : null,
      sentiment: typeof aiResult.sentiment === "string" ? aiResult.sentiment : null,
      urgency: typeof aiResult.urgency === "string" ? aiResult.urgency : null,
      category: typeof aiResult.category === "string" ? aiResult.category : opp.category,
      confidenceScore: typeof aiResult.confidenceScore === "number" ? aiResult.confidenceScore : null,
      estimatedCustomerImpact: typeof aiResult.estimatedCustomerImpact === "string" ? aiResult.estimatedCustomerImpact : null,
      estimatedBusinessImpact: typeof aiResult.estimatedBusinessImpact === "string" ? aiResult.estimatedBusinessImpact : null,
    })
    .where(eq(opportunitiesTable.id, id))
    .returning();

  await recordTimeline(id, "ai_analyzed", "AI analysis completed", {
    sentiment: updated!.sentiment,
    urgency: updated!.urgency,
    confidenceScore: updated!.confidenceScore,
  });

  res.json({ ...updated!, tags: updated!.tags ?? [] });
});

export default router;
