import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { feedbackTable } from "@workspace/db";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { validate } from "../middlewares/validate";
import { AppError, NotFoundError } from "../middlewares/errorHandler";

const router: IRouter = Router();

const createFeedbackSchema = z.object({
  department: z.string().min(1, "department is required"),
  stakeholderName: z.string().min(1, "stakeholderName is required"),
  description: z.string().min(1, "description is required"),
  customerImpact: z.string().optional().nullable(),
  businessContext: z.string().optional().nullable(),
  urgency: z.enum(["low", "medium", "high", "critical"]).optional().nullable(),
  opportunityId: z.number().int().optional().nullable(),
});

const updateFeedbackSchema = createFeedbackSchema.partial();

router.get("/feedback", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const { limit = "50", offset = "0" } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit, 10) || 50, 200);
    const skip = parseInt(offset, 10) || 0;

    const feedback = await db.select().from(feedbackTable)
      .orderBy(desc(feedbackTable.createdAt)).limit(take).offset(skip);

    res.json(feedback);
  } catch (err) { next(err); }
});

router.post(
  "/feedback",
  requireAuth,
  validate(createFeedbackSchema),
  async (req, res, next): Promise<void> => {
    try {
      const body = req.body as z.infer<typeof createFeedbackSchema>;
      const [fb] = await db.insert(feedbackTable).values({
        department: body.department,
        stakeholderName: body.stakeholderName,
        description: body.description,
        customerImpact: body.customerImpact ?? null,
        businessContext: body.businessContext ?? null,
        urgency: body.urgency ?? null,
        opportunityId: body.opportunityId ?? null,
      }).returning();

      res.status(201).json(fb!);
    } catch (err) { next(err); }
  },
);

router.get("/feedback/:id", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError(400, "Invalid id");

    const [fb] = await db.select().from(feedbackTable).where(eq(feedbackTable.id, id));
    if (!fb) throw new NotFoundError("Feedback");
    res.json(fb);
  } catch (err) { next(err); }
});

router.patch(
  "/feedback/:id",
  requireAuth,
  validate(updateFeedbackSchema),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError(400, "Invalid id");

      const body = req.body as z.infer<typeof updateFeedbackSchema>;
      const updateData: Record<string, unknown> = {};
      const fields = ["department", "stakeholderName", "description", "customerImpact", "businessContext", "urgency", "opportunityId"] as const;
      for (const f of fields) {
        if (body[f] !== undefined) updateData[f] = body[f];
      }

      const [updated] = await db.update(feedbackTable)
        .set(updateData as never)
        .where(eq(feedbackTable.id, id))
        .returning();

      if (!updated) throw new NotFoundError("Feedback");
      res.json(updated);
    } catch (err) { next(err); }
  },
);

router.delete("/feedback/:id", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError(400, "Invalid id");

    const [deleted] = await db.delete(feedbackTable).where(eq(feedbackTable.id, id)).returning();
    if (!deleted) throw new NotFoundError("Feedback");
    res.sendStatus(204);
  } catch (err) { next(err); }
});

export default router;
