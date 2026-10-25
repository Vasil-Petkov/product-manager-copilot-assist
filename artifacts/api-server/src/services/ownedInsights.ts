import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, opportunitiesTable, aiInsightsTable } from "@workspace/db";
import { NotFoundError, UnauthorizedError } from "../middlewares/errorHandler";

const generatedInsights = z.array(z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  confidence: z.number().min(0).max(1).nullish(),
  relatedOpportunityIndexes: z.array(z.number().int()).nullish(),
}));

/** Persist generated results without clearing another workspace or legacy data. */
export async function replaceOwnedInsights(userId: string, generated: unknown, opportunityIds: number[]) {
  if (!userId) throw new UnauthorizedError();
  const insights = generatedInsights.parse(generated).slice(0, 6);
  return db.transaction(async (tx) => {
    const uniqueIds = [...new Set(opportunityIds)];
    const owned = uniqueIds.length
      ? await tx.select({ id: opportunitiesTable.id }).from(opportunitiesTable)
        .where(and(inArray(opportunitiesTable.id, uniqueIds), eq(opportunitiesTable.userId, userId))).for("share")
      : [];
    if (owned.length !== uniqueIds.length) throw new NotFoundError("Product Idea");
    await tx.delete(aiInsightsTable).where(eq(aiInsightsTable.userId, userId));
    if (!insights.length) return [];
    return tx.insert(aiInsightsTable).values(insights.map((insight) => ({
      userId, type: insight.type, title: insight.title, content: insight.content,
      confidence: insight.confidence ?? 0.75,
      relatedOpportunityIds: (insight.relatedOpportunityIndexes ?? [])
        .filter(index => index >= 0 && index < opportunityIds.length)
        .map(index => String(opportunityIds[index])),
    }))).returning();
  });
}
