import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { meetingsTable, opportunitiesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/meetings", async (req, res): Promise<void> => {
  const meetings = await db.select().from(meetingsTable).orderBy(meetingsTable.meetingDate);
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
      attendees: attendees ?? [],
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
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
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
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const updateData: Record<string, unknown> = {};
  for (const field of ["title", "attendees", "transcript", "notes"]) {
    if (req.body[field] !== undefined) updateData[field] = req.body[field];
  }
  if (req.body.meetingDate) updateData.meetingDate = new Date(req.body.meetingDate);

  const [updated] = await db.update(meetingsTable).set(updateData as never).where(eq(meetingsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...updated, attendees: updated.attendees ?? [], opportunitiesExtracted: parseInt(updated.opportunitiesExtracted ?? "0", 10) });
});

router.delete("/meetings/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(meetingsTable).where(eq(meetingsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

router.post("/meetings/:id/analyze", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [meeting] = await db.select().from(meetingsTable).where(eq(meetingsTable.id, id));
  if (!meeting) { res.status(404).json({ error: "Not found" }); return; }

  const content = meeting.transcript ?? meeting.notes ?? "";
  const insights = await extractInsightsFromText(content, meeting.title);

  // Create opportunities from extracted feature requests
  let opportunitiesCreated = 0;
  for (const fr of insights.featureRequests.slice(0, 3)) {
    await db.insert(opportunitiesTable).values({
      title: fr,
      description: `Extracted from meeting: ${meeting.title}`,
      sourceType: "meeting",
      status: "new",
      tags: ["meeting-extracted"],
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
  if (!text || text.trim().length === 0) {
    return {
      painPoints: [`No transcript available for: ${meetingTitle}`],
      featureRequests: [],
      risks: [],
      actionItems: [],
      businessOpportunities: [],
      competitorMentions: [],
      openQuestions: [],
      summary: `Meeting "${meetingTitle}" has no transcript. Upload a transcript to extract insights.`,
    };
  }

  const { openai } = await import("@workspace/integrations-openai-ai-server");

  const prompt = `Analyze this meeting transcript and extract structured insights. Return a JSON object with:
- painPoints (string[]): customer/user pain points mentioned
- featureRequests (string[]): specific feature requests or product asks
- risks (string[]): risks, concerns, or uncertainties raised
- actionItems (string[]): concrete action items or next steps
- businessOpportunities (string[]): business or market opportunities identified
- competitorMentions (string[]): competitor mentions or comparisons
- openQuestions (string[]): unresolved questions that need follow-up
- summary (string): 2-3 sentence executive summary of the meeting

Meeting: ${meetingTitle}
Transcript:
${text.substring(0, 4000)}

Return only valid JSON, no markdown.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = response.choices[0]?.message?.content ?? "{}";
    return JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
  } catch {
    // Fallback to keyword extraction
    const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 10);
    const painPoints = sentences.filter((s) => /difficult|problem|issue|broken|frustrat|slow|hard to|can't|cannot/i.test(s)).slice(0, 5);
    const featureRequests = sentences.filter((s) => /would like|need|want|request|add|build|implement|could we|can we/i.test(s)).slice(0, 5);
    const actionItems = sentences.filter((s) => /will|should|need to|action|follow up|next step/i.test(s)).slice(0, 5);
    return {
      painPoints: painPoints.length > 0 ? painPoints : ["Review transcript for pain points"],
      featureRequests: featureRequests.length > 0 ? featureRequests : ["Review transcript for feature requests"],
      risks: [],
      actionItems,
      businessOpportunities: [],
      competitorMentions: [],
      openQuestions: [],
      summary: `Meeting "${meetingTitle}" analyzed using keyword extraction (AI unavailable).`,
    };
  }
}

export default router;
