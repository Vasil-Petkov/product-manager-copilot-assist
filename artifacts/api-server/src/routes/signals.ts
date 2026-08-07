import { Router, type IRouter } from "express";
import { eq, and, SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { signalsTable, opportunitiesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/signals", async (req, res): Promise<void> => {
  const { source_type, processed } = req.query as Record<string, string>;

  const conditions: SQL[] = [];
  if (source_type) conditions.push(eq(signalsTable.sourceType, source_type));
  if (processed !== undefined) {
    conditions.push(eq(signalsTable.processed, processed === "true"));
  }

  const signals =
    conditions.length > 0
      ? await db.select().from(signalsTable).where(and(...conditions)).orderBy(signalsTable.createdAt)
      : await db.select().from(signalsTable).orderBy(signalsTable.createdAt);

  res.json(
    signals.map((s) => ({
      ...s,
      opportunityId: s.opportunityId ? parseInt(s.opportunityId, 10) : null,
    }))
  );
});

router.post("/signals", async (req, res): Promise<void> => {
  const { content, sourceType, sourcePlatform, author, sourceUrl, votes, customerId } = req.body;

  if (!content || !sourceType) {
    res.status(400).json({ error: "content and sourceType are required" });
    return;
  }

  // Insert signal
  const [signal] = await db
    .insert(signalsTable)
    .values({
      content,
      sourceType,
      sourcePlatform: sourcePlatform ?? null,
      author: author ?? null,
      sourceUrl: sourceUrl ?? null,
      votes: votes ? String(votes) : null,
      customerId: customerId ?? null,
      sentiment: detectSentiment(content),
      processed: false,
    })
    .returning();

  // Auto-create opportunity from signal
  const [opp] = await db
    .insert(opportunitiesTable)
    .values({
      title: `Signal: ${content.substring(0, 60)}${content.length > 60 ? "..." : ""}`,
      description: content,
      sourceType,
      originalContent: content,
      sentiment: signal!.sentiment,
      status: "new",
      tags: [],
    })
    .returning();

  // Mark signal as processed and link to opportunity
  const [updatedSignal] = await db
    .update(signalsTable)
    .set({ processed: true, opportunityId: String(opp!.id) })
    .where(eq(signalsTable.id, signal!.id))
    .returning();

  res.status(201).json({
    signal: { ...updatedSignal!, opportunityId: opp!.id },
    opportunity: { ...opp!, tags: opp!.tags ?? [] },
  });
});

router.delete("/signals/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(signalsTable).where(eq(signalsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

router.post("/signals/bulk", async (req, res): Promise<void> => {
  const { signals, sourceType } = req.body;
  if (!Array.isArray(signals) || signals.length === 0) {
    res.status(400).json({ error: "signals array is required" });
    return;
  }

  const insertedSignals = [];
  let opportunitiesCreated = 0;

  for (const s of signals) {
    const content = s.content ?? s;
    if (!content) continue;

    const [signal] = await db
      .insert(signalsTable)
      .values({
        content: String(content),
        sourceType: s.sourceType ?? sourceType ?? "other",
        sourcePlatform: s.sourcePlatform ?? null,
        author: s.author ?? null,
        sentiment: detectSentiment(String(content)),
        processed: true,
      })
      .returning();

    // Create opportunity
    await db.insert(opportunitiesTable).values({
      title: `Signal: ${String(content).substring(0, 60)}${String(content).length > 60 ? "..." : ""}`,
      description: String(content),
      sourceType: s.sourceType ?? sourceType ?? "other",
      originalContent: String(content),
      sentiment: signal!.sentiment,
      status: "new",
      tags: [],
    });
    opportunitiesCreated++;
    insertedSignals.push({ ...signal!, opportunityId: null });
  }

  res.status(201).json({
    imported: insertedSignals.length,
    opportunitiesCreated,
    signals: insertedSignals,
  });
});

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
