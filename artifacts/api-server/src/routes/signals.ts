import { Router, type IRouter } from "express";
import { eq, and, SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { signalsTable, opportunitiesTable } from "@workspace/db";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validate } from "../middlewares/validate";
import { AppError } from "../middlewares/errorHandler";

const router: IRouter = Router();

const createSignalSchema = z.object({
  content: z.string().min(1, "content is required"),
  sourceType: z.string().min(1, "sourceType is required"),
  sourcePlatform: z.string().optional().nullable(),
  author: z.string().optional().nullable(),
  sourceUrl: z.string().optional().nullable(),
  votes: z.number().int().optional().nullable(),
  customerId: z.string().optional().nullable(),
});

const bulkSignalSchema = z.object({
  signals: z.array(z.union([
    z.string(),
    z.object({
      content: z.string(),
      sourceType: z.string().optional(),
      sourcePlatform: z.string().optional().nullable(),
      author: z.string().optional().nullable(),
    }),
  ])).min(1),
  sourceType: z.string().optional(),
});

// ─── List ────────────────────────────────────────────────────────────────────

router.get("/signals", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const { source_type, processed, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit, 10) || 50, 200);
    const skip = parseInt(offset, 10) || 0;

    const conditions: SQL[] = [];
    if (source_type) conditions.push(eq(signalsTable.sourceType, source_type));
    if (processed !== undefined) conditions.push(eq(signalsTable.processed, processed === "true"));

    const signals = conditions.length > 0
      ? await db.select().from(signalsTable).where(and(...conditions))
          .orderBy(signalsTable.createdAt).limit(take).offset(skip)
      : await db.select().from(signalsTable)
          .orderBy(signalsTable.createdAt).limit(take).offset(skip);

    res.json(signals);
  } catch (err) { next(err); }
});

// ─── Create (auto-creates opportunity) ───────────────────────────────────────

router.post(
  "/signals",
  requireAuth,
  validate(createSignalSchema),
  async (req, res, next): Promise<void> => {
    try {
      const body = req.body as z.infer<typeof createSignalSchema>;

      const [signal] = await db.insert(signalsTable).values({
        content: body.content,
        sourceType: body.sourceType,
        sourcePlatform: body.sourcePlatform ?? null,
        author: body.author ?? null,
        sourceUrl: body.sourceUrl ?? null,
        votes: body.votes ?? null,
        customerId: body.customerId ?? null,
        sentiment: detectSentiment(body.content),
        processed: false,
      }).returning();

      // Auto-create opportunity from signal
      const [opp] = await db.insert(opportunitiesTable).values({
        title: `Signal: ${body.content.substring(0, 60)}${body.content.length > 60 ? "..." : ""}`,
        description: body.content,
        sourceType: body.sourceType,
        originalContent: body.content,
        sentiment: signal!.sentiment,
        status: "new",
        tags: [],
        userId: req.user!.id,
      }).returning();

      // Mark signal as processed and link to opportunity
      const [updatedSignal] = await db
        .update(signalsTable)
        .set({ processed: true, opportunityId: opp!.id })
        .where(eq(signalsTable.id, signal!.id))
        .returning();

      res.status(201).json({
        signal: updatedSignal!,
        opportunity: { ...opp!, tags: opp!.tags ?? [] },
      });
    } catch (err) { next(err); }
  },
);

// ─── Delete ──────────────────────────────────────────────────────────────────

router.delete("/signals/:id", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError(400, "Invalid id");

    const [deleted] = await db.delete(signalsTable).where(eq(signalsTable.id, id)).returning();
    if (!deleted) throw new AppError(404, "Signal not found");
    res.sendStatus(204);
  } catch (err) { next(err); }
});

// ─── Bulk Import ─────────────────────────────────────────────────────────────

router.post(
  "/signals/bulk",
  requireAuth,
  validate(bulkSignalSchema),
  async (req, res, next): Promise<void> => {
    try {
      const { signals, sourceType } = req.body as z.infer<typeof bulkSignalSchema>;
      const insertedSignals = [];
      let opportunitiesCreated = 0;

      for (const s of signals) {
        const content = typeof s === "string" ? s : s.content;
        if (!content) continue;

        const srcType = (typeof s === "object" ? s.sourceType : null) ?? sourceType ?? "other";

        const [signal] = await db.insert(signalsTable).values({
          content,
          sourceType: srcType,
          sourcePlatform: typeof s === "object" ? s.sourcePlatform ?? null : null,
          author: typeof s === "object" ? s.author ?? null : null,
          sentiment: detectSentiment(content),
          processed: true,
        }).returning();

        const [opp] = await db.insert(opportunitiesTable).values({
          title: `Signal: ${content.substring(0, 60)}${content.length > 60 ? "..." : ""}`,
          description: content,
          sourceType: srcType,
          originalContent: content,
          sentiment: signal!.sentiment,
          status: "new",
          tags: [],
          userId: req.user!.id,
        }).returning();

        await db.update(signalsTable)
          .set({ opportunityId: opp!.id })
          .where(eq(signalsTable.id, signal!.id));

        opportunitiesCreated++;
        insertedSignals.push(signal!);
      }

      res.status(201).json({
        imported: insertedSignals.length,
        opportunitiesCreated,
        signals: insertedSignals,
      });
    } catch (err) { next(err); }
  },
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectSentiment(text: string): string {
  const lower = text.toLowerCase();
  const negativeWords = ["broken", "bug", "issue", "problem", "error", "fail", "slow", "crash", "hate", "terrible", "bad", "awful", "difficult", "frustrat"];
  const positiveWords = ["love", "great", "awesome", "excellent", "perfect", "amazing", "fast", "easy", "good", "nice", "helpful", "fantastic"];
  let score = 0;
  for (const w of negativeWords) if (lower.includes(w)) score--;
  for (const w of positiveWords) if (lower.includes(w)) score++;
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

export default router;
