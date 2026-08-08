import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { meetingsTable, opportunitiesTable } from "@workspace/db";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validate } from "../middlewares/validate";
import { AppError, NotFoundError } from "../middlewares/errorHandler";
import { recordTimeline } from "./product-ideas";
import { buildProductContext, formatContextForPrompt } from "../services/contextEngine";

const router: IRouter = Router();

const createMeetingSchema = z.object({
  title: z.string().min(1, "title is required"),
  meetingDate: z.string().min(1, "meetingDate is required"),
  attendees: z.array(z.string()).optional().default([]),
  transcript: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateMeetingSchema = createMeetingSchema.partial();

// ─── List ────────────────────────────────────────────────────────────────────

router.get("/meetings", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const { limit = "50", offset = "0" } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit, 10) || 50, 200);
    const skip = parseInt(offset, 10) || 0;

    const meetings = await db.select().from(meetingsTable)
      .orderBy(desc(meetingsTable.meetingDate)).limit(take).offset(skip);

    res.json(meetings.map((m) => ({
      ...m,
      attendees: m.attendees ?? [],
      opportunitiesExtracted: parseInt(m.opportunitiesExtracted ?? "0", 10),
    })));
  } catch (err) { next(err); }
});

// ─── Create ──────────────────────────────────────────────────────────────────

router.post(
  "/meetings",
  requireAuth,
  validate(createMeetingSchema),
  async (req, res, next): Promise<void> => {
    try {
      const body = req.body as z.infer<typeof createMeetingSchema>;
      const [meeting] = await db.insert(meetingsTable).values({
        title: body.title,
        meetingDate: new Date(body.meetingDate),
        attendees: body.attendees ?? [],
        transcript: body.transcript ?? null,
        notes: body.notes ?? null,
        analyzed: false,
        opportunitiesExtracted: "0",
        userId: req.user!.id,
      }).returning();

      res.status(201).json({
        ...meeting!,
        attendees: meeting!.attendees ?? [],
        opportunitiesExtracted: 0,
      });
    } catch (err) { next(err); }
  },
);

// ─── Get One ─────────────────────────────────────────────────────────────────

router.get("/meetings/:id", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError(400, "Invalid id");

    const [meeting] = await db.select().from(meetingsTable).where(eq(meetingsTable.id, id));
    if (!meeting) throw new NotFoundError("Meeting");

    res.json({
      ...meeting,
      attendees: meeting.attendees ?? [],
      opportunitiesExtracted: parseInt(meeting.opportunitiesExtracted ?? "0", 10),
      extractedInsights: meeting.extractedInsights ?? null,
    });
  } catch (err) { next(err); }
});

// ─── Update ──────────────────────────────────────────────────────────────────

router.patch(
  "/meetings/:id",
  requireAuth,
  validate(updateMeetingSchema),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError(400, "Invalid id");

      const body = req.body as z.infer<typeof updateMeetingSchema>;
      const updateData: Record<string, unknown> = {};
      if (body.title !== undefined) updateData.title = body.title;
      if (body.meetingDate !== undefined) updateData.meetingDate = new Date(body.meetingDate);
      if (body.attendees !== undefined) updateData.attendees = body.attendees;
      if (body.transcript !== undefined) updateData.transcript = body.transcript;
      if (body.notes !== undefined) updateData.notes = body.notes;

      const [updated] = await db.update(meetingsTable)
        .set(updateData as never)
        .where(eq(meetingsTable.id, id))
        .returning();

      if (!updated) throw new NotFoundError("Meeting");
      res.json({
        ...updated,
        attendees: updated.attendees ?? [],
        opportunitiesExtracted: parseInt(updated.opportunitiesExtracted ?? "0", 10),
      });
    } catch (err) { next(err); }
  },
);

// ─── Delete ──────────────────────────────────────────────────────────────────

router.delete("/meetings/:id", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError(400, "Invalid id");

    const [deleted] = await db.delete(meetingsTable).where(eq(meetingsTable.id, id)).returning();
    if (!deleted) throw new NotFoundError("Meeting");
    res.sendStatus(204);
  } catch (err) { next(err); }
});

// ─── AI Analyze (via Context Engine for each extracted idea) ──────────────────

router.post("/meetings/:id/analyze", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError(400, "Invalid id");

    const [meeting] = await db.select().from(meetingsTable).where(eq(meetingsTable.id, id));
    if (!meeting) throw new NotFoundError("Meeting");

    const { openai } = await import("@workspace/integrations-openai-ai-server");

    let extractedInsights: Record<string, unknown> = {};
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.6-luna",
        max_completion_tokens: 3000,
        messages: [{
          role: "user",
          content: `You are an expert product manager analyzing a customer/team meeting transcript.

Meeting: "${meeting.title}"
Date: ${meeting.meetingDate.toISOString().split("T")[0]}
Attendees: ${(meeting.attendees ?? []).join(", ") || "Unknown"}

Transcript:
${meeting.transcript ?? meeting.notes ?? "No transcript provided"}

Extract the following from this meeting. Return valid JSON:
{
  "summary": "2-3 sentence meeting summary",
  "keyThemes": ["theme1", "theme2"],
  "actionItems": ["action1", "action2"],
  "painPoints": [
    { "title": "Pain point title", "description": "Description", "urgency": "high|medium|low", "customerSegment": "segment" }
  ],
  "featureRequests": [
    { "title": "Feature title", "description": "Description", "businessValue": "Why this matters" }
  ],
  "businessOpportunities": [
    { "title": "Opportunity title", "description": "Description", "marketSize": "Estimate" }
  ],
  "sentimentOverall": "positive|neutral|negative"
}`,
        }],
      });

      const raw = (response.choices[0]?.message?.content ?? "{}").replace(/```json\n?|\n?```/g, "").trim();
      extractedInsights = JSON.parse(raw);
    } catch {
      extractedInsights = {
        summary: `Meeting "${meeting.title}" analyzed. Review transcript for details.`,
        keyThemes: [],
        actionItems: [],
        painPoints: [],
        featureRequests: [],
        businessOpportunities: [],
        sentimentOverall: "neutral",
      };
    }

    // Extract and create Product Ideas
    const createdOpps: Array<typeof opportunitiesTable.$inferSelect> = [];
    const allExtracted = [
      ...((extractedInsights.painPoints as Array<Record<string, string>>) ?? []).map((p) => ({
        title: p.title ?? "Pain Point",
        description: p.description ?? "",
        category: "pain_point" as const,
        urgency: (p.urgency as "low" | "medium" | "high" | "critical") ?? "medium",
        customerProblem: p.description,
        customerSegment: p.customerSegment,
      })),
      ...((extractedInsights.featureRequests as Array<Record<string, string>>) ?? []).map((f) => ({
        title: f.title ?? "Feature Request",
        description: f.description ?? "",
        category: "feature_request" as const,
        urgency: "medium" as const,
        businessValue: f.businessValue,
      })),
      ...((extractedInsights.businessOpportunities as Array<Record<string, string>>) ?? []).map((b) => ({
        title: b.title ?? "Market Opportunity",
        description: b.description ?? "",
        category: "market_opportunity" as const,
        urgency: "medium" as const,
        businessValue: b.description,
      })),
    ];

    for (const item of allExtracted) {
      if (!item.title || !item.description) continue;
      const [opp] = await db.insert(opportunitiesTable).values({
        title: item.title,
        description: item.description,
        sourceType: "meeting",
        category: item.category,
        urgency: item.urgency,
        customerProblem: "customerProblem" in item ? item.customerProblem : null,
        businessValue: "businessValue" in item ? item.businessValue : null,
        status: "new",
        tags: [],
        userId: req.user!.id,
      }).returning();

      if (opp) {
        createdOpps.push(opp);
        await recordTimeline(opp.id, "created", `Extracted from meeting: ${meeting.title}`);
      }
    }

    // Update meeting as analyzed
    const [updated] = await db
      .update(meetingsTable)
      .set({
        analyzed: true,
        opportunitiesExtracted: String(createdOpps.length),
        extractedInsights,
      })
      .where(eq(meetingsTable.id, id))
      .returning();

    res.json({
      meeting: { ...updated!, attendees: updated!.attendees ?? [], opportunitiesExtracted: createdOpps.length },
      extractedInsights,
      opportunitiesCreated: createdOpps.length,
      opportunities: createdOpps.map((o) => ({ ...o, tags: o.tags ?? [] })),
    });
  } catch (err) { next(err); }
});

export default router;
