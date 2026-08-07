import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { meetingsTable, opportunitiesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/meetings", async (req, res): Promise<void> => {
  const meetings = await db.select().from(meetingsTable).orderBy(desc(meetingsTable.meetingDate));
  res.json(
    meetings.map((m) => ({
      ...m,
      attendees: m.attendees ?? [],
      opportunitiesExtracted: parseInt(m.opportunitiesExtracted ?? "0", 10),
    }))
  );
});

router.post("/meetings", async (req, res): Promise<void> => {
  const { title, meetingDate, attendees, transcript, notes } = req.body;
  if (!title || !meetingDate) {
    res.status(400).json({ error: "title and meetingDate are required" });
    return;
  }

  const [meeting] = await db
    .insert(meetingsTable)
    .values({
      title,
      meetingDate: new Date(meetingDate),
      attendees: Array.isArray(attendees) ? attendees : [],
      transcript: transcript ?? null,
      notes: notes ?? null,
      analyzed: false,
      opportunitiesExtracted: "0",
    })
    .returning();

  res.status(201).json({
    ...meeting!,
    attendees: meeting!.attendees ?? [],
    opportunitiesExtracted: 0,
  });
});

router.get("/meetings/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [meeting] = await db.select().from(meetingsTable).where(eq(meetingsTable.id, id));
  if (!meeting) { res.status(404).json({ error: "Not found" }); return; }

  res.json({
    ...meeting,
    attendees: meeting.attendees ?? [],
    opportunitiesExtracted: parseInt(meeting.opportunitiesExtracted ?? "0", 10),
    extractedInsights: meeting.extractedInsights ?? null,
  });
});

router.patch("/meetings/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const updateData: Record<string, unknown> = {};
  if (req.body.title !== undefined) updateData.title = req.body.title;
  if (req.body.attendees !== undefined) updateData.attendees = req.body.attendees;
  if (req.body.transcript !== undefined) updateData.transcript = req.body.transcript;
  if (req.body.notes !== undefined) updateData.notes = req.body.notes;
  if (req.body.meetingDate !== undefined) updateData.meetingDate = new Date(req.body.meetingDate);

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(meetingsTable)
    .set(updateData as never)
    .where(eq(meetingsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({
    ...updated,
    attendees: updated.attendees ?? [],
    opportunitiesExtracted: parseInt(updated.opportunitiesExtracted ?? "0", 10),
  });
});

router.delete("/meetings/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(meetingsTable).where(eq(meetingsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

router.post("/meetings/:id/analyze", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [meeting] = await db.select().from(meetingsTable).where(eq(meetingsTable.id, id));
  if (!meeting) { res.status(404).json({ error: "Not found" }); return; }

  const content = meeting.transcript ?? meeting.notes ?? "";
  const insights = await extractInsightsFromText(content, meeting.title);

  // Save opportunities from ALL insight categories
  let opportunitiesCreated = 0;

  // Pain points → opportunities (category: pain_point)
  const painPoints: string[] = Array.isArray(insights.painPoints) ? insights.painPoints : [];
  for (const pp of painPoints.slice(0, 3)) {
    if (!pp || typeof pp !== "string") continue;
    await db.insert(opportunitiesTable).values({
      title: pp.substring(0, 200),
      description: `Pain point extracted from meeting: "${meeting.title}"`,
      sourceType: "meeting",
      category: "pain_point",
      customerProblem: pp,
      status: "new",
      tags: ["meeting-extracted", "pain-point"],
    });
    opportunitiesCreated++;
  }

  // Feature requests → opportunities (category: feature_request)
  const featureRequests: string[] = Array.isArray(insights.featureRequests) ? insights.featureRequests : [];
  for (const fr of featureRequests.slice(0, 3)) {
    if (!fr || typeof fr !== "string") continue;
    await db.insert(opportunitiesTable).values({
      title: fr.substring(0, 200),
      description: `Feature request extracted from meeting: "${meeting.title}"`,
      sourceType: "meeting",
      category: "feature_request",
      suggestedSolution: fr,
      status: "new",
      tags: ["meeting-extracted", "feature-request"],
    });
    opportunitiesCreated++;
  }

  // Business opportunities → opportunities (category: market_opportunity)
  const bizOpps: string[] = Array.isArray(insights.businessOpportunities) ? insights.businessOpportunities : [];
  for (const bo of bizOpps.slice(0, 2)) {
    if (!bo || typeof bo !== "string") continue;
    await db.insert(opportunitiesTable).values({
      title: bo.substring(0, 200),
      description: `Business opportunity identified in meeting: "${meeting.title}"`,
      sourceType: "meeting",
      category: "market_opportunity",
      businessValue: bo,
      status: "new",
      tags: ["meeting-extracted", "opportunity"],
    });
    opportunitiesCreated++;
  }

  const [updated] = await db
    .update(meetingsTable)
    .set({
      analyzed: true,
      opportunitiesExtracted: String(opportunitiesCreated),
      extractedInsights: insights as never,
    })
    .where(eq(meetingsTable.id, id))
    .returning();

  res.json({
    ...updated!,
    attendees: updated!.attendees ?? [],
    opportunitiesExtracted: opportunitiesCreated,
    extractedInsights: insights,
  });
});

async function extractInsightsFromText(text: string, meetingTitle: string) {
  const empty = {
    painPoints: [] as string[],
    featureRequests: [] as string[],
    risks: [] as string[],
    actionItems: [] as string[],
    businessOpportunities: [] as string[],
    competitorMentions: [] as string[],
    openQuestions: [] as string[],
    summary: "",
  };

  if (!text || text.trim().length === 0) {
    return {
      ...empty,
      painPoints: [`No transcript available for: ${meetingTitle}`],
      summary: `Meeting "${meetingTitle}" has no transcript. Upload one to extract AI insights.`,
    };
  }

  try {
    const { openai } = await import("@workspace/integrations-openai-ai-server");

    const prompt = `Analyze this meeting transcript and extract structured insights. Return a JSON object with exactly these fields (all arrays of concise strings):
- painPoints: customer/user pain points and frustrations mentioned
- featureRequests: specific features or capabilities requested
- risks: risks, concerns, or blockers raised
- actionItems: concrete next steps or action items
- businessOpportunities: market or business opportunities identified
- competitorMentions: any competitor products or alternatives mentioned
- openQuestions: unresolved questions needing follow-up
- summary: 2-3 sentence executive summary

Meeting: ${meetingTitle}
Transcript:
${text.substring(0, 4000)}

Return only valid JSON, no markdown or code blocks.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (response.choices[0]?.message?.content ?? "{}").replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(raw);

    // Ensure all array fields are actually arrays
    return {
      painPoints: Array.isArray(parsed.painPoints) ? parsed.painPoints : [],
      featureRequests: Array.isArray(parsed.featureRequests) ? parsed.featureRequests : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      businessOpportunities: Array.isArray(parsed.businessOpportunities) ? parsed.businessOpportunities : [],
      competitorMentions: Array.isArray(parsed.competitorMentions) ? parsed.competitorMentions : [],
      openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : `Analysis of "${meetingTitle}" complete.`,
    };
  } catch {
    // Keyword-based fallback
    const sentences = text.split(/[.!?\n]+/).map((s) => s.trim()).filter((s) => s.length > 15);
    return {
      painPoints: sentences.filter((s) => /difficult|problem|issue|broken|frustrat|slow|hard to|can't|cannot|struggle/i.test(s)).slice(0, 5),
      featureRequests: sentences.filter((s) => /would like|need|want|request|add|build|implement|could we|can we|feature|wish/i.test(s)).slice(0, 5),
      risks: sentences.filter((s) => /risk|concern|worry|uncertain|might fail|danger|threat|blocker/i.test(s)).slice(0, 3),
      actionItems: sentences.filter((s) => /will|should|need to|action|follow up|next step|by \w+day|todo/i.test(s)).slice(0, 5),
      businessOpportunities: sentences.filter((s) => /opportunity|market|revenue|growth|expand|customer segment/i.test(s)).slice(0, 3),
      competitorMentions: sentences.filter((s) => /competitor|alternative|instead|versus|vs\.|compared to/i.test(s)).slice(0, 3),
      openQuestions: sentences.filter((s) => /\?/.test(s)).slice(0, 5),
      summary: `Meeting "${meetingTitle}" analyzed using keyword extraction (AI fallback). ${sentences.length} sentences processed.`,
    };
  }
}

export default router;
