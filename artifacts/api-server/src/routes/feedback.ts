import { Router, type IRouter } from "express";
import { eq, and, SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { feedbackTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/feedback", async (req, res): Promise<void> => {
  const { department } = req.query as Record<string, string>;

  const rows = department
    ? await db.select().from(feedbackTable).where(eq(feedbackTable.department, department)).orderBy(feedbackTable.createdAt)
    : await db.select().from(feedbackTable).orderBy(feedbackTable.createdAt);

  res.json(
    rows.map((r) => ({
      ...r,
      opportunityId: r.opportunityId ? parseInt(r.opportunityId, 10) : null,
    }))
  );
});

router.post("/feedback", async (req, res): Promise<void> => {
  const { department, stakeholderName, description, customerImpact, businessContext, urgency } = req.body;

  if (!department || !stakeholderName || !description) {
    res.status(400).json({ error: "department, stakeholderName, and description are required" });
    return;
  }

  const [row] = await db
    .insert(feedbackTable)
    .values({
      department,
      stakeholderName,
      description,
      customerImpact: customerImpact ?? null,
      businessContext: businessContext ?? null,
      urgency: urgency ?? null,
    })
    .returning();

  res.status(201).json({ ...row!, opportunityId: null });
});

router.get("/feedback/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db.select().from(feedbackTable).where(eq(feedbackTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...row, opportunityId: row.opportunityId ? parseInt(row.opportunityId, 10) : null });
});

router.patch("/feedback/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const updateData: Record<string, unknown> = {};
  for (const field of ["department", "stakeholderName", "description", "customerImpact", "businessContext", "urgency"]) {
    if (req.body[field] !== undefined) updateData[field] = req.body[field];
  }

  const [updated] = await db.update(feedbackTable).set(updateData as never).where(eq(feedbackTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...updated, opportunityId: updated.opportunityId ? parseInt(updated.opportunityId, 10) : null });
});

router.delete("/feedback/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(feedbackTable).where(eq(feedbackTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

export default router;
