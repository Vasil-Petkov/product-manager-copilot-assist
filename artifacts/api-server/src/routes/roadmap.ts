import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  CreateRoadmapInitiativeBody,
  CreateRoadmapInitiativeResponse,
  CreateRoadmapItemBody,
  CreateRoadmapItemResponse,
  CreateRoadmapMilestoneBody,
  CreateRoadmapMilestoneResponse,
  DeleteRoadmapInitiativeResponse,
  DeleteRoadmapItemResponse,
  DeleteRoadmapMilestoneResponse,
  GenerateRoadmapProposalResponse,
  GetRoadmapResponse,
  UpdateRoadmapInitiativeBody,
  UpdateRoadmapInitiativeResponse,
  UpdateRoadmapItemBody,
  UpdateRoadmapItemResponse,
  UpdateRoadmapMilestoneBody,
  UpdateRoadmapMilestoneResponse,
} from "@workspace/api-zod";
import {
  db,
  opportunitiesTable,
  prioritizationScoresTable,
  roadmapInitiativesTable,
  roadmapItemsTable,
  roadmapMilestonesTable,
  validationExperiments,
  validationHypotheses,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { AppError, NotFoundError } from "../middlewares/errorHandler";
import { buildProductContext, formatContextForPrompt } from "../services/contextEngine";

const router: IRouter = Router();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const dateString = z.string().regex(DATE_PATTERN, "Dates must use YYYY-MM-DD");
const roadmapStatus = z.enum(["planned", "in_progress", "completed", "at_risk", "on_hold"]);
const idSchema = z.coerce.number().int().positive();

const initiativeInput = z.object({
  name: z.string().trim().min(1).max(240),
  description: z.string().trim().max(4000).nullable().optional(),
});

const itemInput = z.object({
  initiativeId: idSchema.nullable().optional(),
  opportunityId: idSchema,
  startDate: dateString,
  endDate: dateString,
  status: roadmapStatus.optional(),
  progress: z.number().int().min(0).max(100).optional(),
  notes: z.string().trim().max(6000).nullable().optional(),
});

const itemUpdate = itemInput.partial().omit({ opportunityId: true }).extend({
  opportunityId: idSchema.optional(),
});

const milestoneInput = z.object({
  initiativeId: idSchema.nullable().optional(),
  name: z.string().trim().min(1).max(240),
  date: dateString,
  description: z.string().trim().max(4000).nullable().optional(),
});

function asId(value: string | string[] | undefined) {
  const parsed = idSchema.safeParse(Array.isArray(value) ? value[0] : value);
  if (!parsed.success) throw new AppError(400, "Invalid id");
  return parsed.data;
}

function asJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function ensureDateRange(startDate: string, endDate: string) {
  if (endDate < startDate) throw new AppError(400, "End date must be on or after start date");
}

async function ensureOwnedInitiative(initiativeId: number | null | undefined, userId: string) {
  if (initiativeId == null) return;
  const [initiative] = await db.select({ id: roadmapInitiativesTable.id })
    .from(roadmapInitiativesTable)
    .where(and(eq(roadmapInitiativesTable.id, initiativeId), eq(roadmapInitiativesTable.userId, userId)));
  if (!initiative) throw new NotFoundError("Initiative");
}

async function ensureOwnedOpportunity(opportunityId: number, userId: string) {
  const [idea] = await db.select({ id: opportunitiesTable.id })
    .from(opportunitiesTable)
    .where(and(eq(opportunitiesTable.id, opportunityId), eq(opportunitiesTable.userId, userId)));
  if (!idea) throw new NotFoundError("Product Idea");
}

async function listRoadmap(userId: string) {
  const [initiatives, milestones, rows] = await Promise.all([
    db.select().from(roadmapInitiativesTable)
      .where(eq(roadmapInitiativesTable.userId, userId))
      .orderBy(asc(roadmapInitiativesTable.createdAt)),
    db.select().from(roadmapMilestonesTable)
      .where(eq(roadmapMilestonesTable.userId, userId))
      .orderBy(asc(roadmapMilestonesTable.date)),
    db.select({ item: roadmapItemsTable, idea: opportunitiesTable })
      .from(roadmapItemsTable)
      .innerJoin(opportunitiesTable, eq(roadmapItemsTable.opportunityId, opportunitiesTable.id))
      .where(and(eq(roadmapItemsTable.userId, userId), eq(opportunitiesTable.userId, userId)))
      .orderBy(asc(roadmapItemsTable.startDate)),
  ]);

  const ideaIds = rows.map((row) => row.idea.id);
  const scores = ideaIds.length
    ? await db.select().from(prioritizationScoresTable)
      .where(inArray(prioritizationScoresTable.opportunityId, ideaIds))
      .orderBy(desc(prioritizationScoresTable.createdAt))
    : [];
  const riceScoreByIdea = new Map<number, number | null>();
  for (const score of scores) {
    if (!riceScoreByIdea.has(score.opportunityId)) riceScoreByIdea.set(score.opportunityId, score.riceScore);
  }

  return {
    initiatives,
    milestones,
    items: rows.map(({ item, idea }) => ({
      ...item,
      productIdea: {
        id: idea.id,
        title: idea.title,
        description: idea.description,
        category: idea.category,
        status: idea.status,
        urgency: idea.urgency,
        confidenceScore: idea.confidenceScore,
        riceScore: riceScoreByIdea.get(idea.id) ?? null,
      },
    })),
  };
}

function defaultProposal(ideas: Array<{ id: number; title: string; category: string | null; urgency: string | null; riceScore: number | null }>) {
  const today = new Date();
  const toDate = (offsetMonths: number) => {
    const value = new Date(today.getFullYear(), today.getMonth() + offsetMonths, 1);
    return value.toISOString().slice(0, 10);
  };
  const groups = new Map<string, typeof ideas>();
  for (const idea of ideas) {
    const key = idea.category?.replaceAll("_", " ") || "Product improvements";
    groups.set(key, [...(groups.get(key) ?? []), idea]);
  }
  return {
    initiatives: [...groups.entries()].map(([name, groupedIdeas], groupIndex) => ({
      name: name.replace(/\b\w/g, (letter) => letter.toUpperCase()),
      description: "A focused sequence of related Product Ideas.",
      reason: "Grouped by the available Product Idea category and priority context.",
      items: groupedIdeas
        .sort((a, b) => (b.riceScore ?? 0) - (a.riceScore ?? 0))
        .map((idea, itemIndex) => ({
          opportunityId: idea.id,
          sequence: itemIndex + 1,
          startDate: toDate(groupIndex * 2 + itemIndex),
          endDate: toDate(groupIndex * 2 + itemIndex + 1),
          status: "planned",
          progress: 0,
          notes: "",
          risks: idea.riceScore == null ? ["Prioritization information is not yet available."] : [],
          why: idea.riceScore == null ? "Schedule after validating priority and effort." : "Sequenced using available RICE context.",
        })),
    })),
  };
}

router.get("/roadmap", requireAuth, async (req, res, next): Promise<void> => {
  try {
    res.json(GetRoadmapResponse.parse(asJson(await listRoadmap(req.user!.id))));
  } catch (err) { next(err); }
});

router.post("/roadmap/initiatives", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const body = initiativeInput.parse(CreateRoadmapInitiativeBody.parse(req.body));
    const [initiative] = await db.insert(roadmapInitiativesTable).values({
      userId: req.user!.id,
      name: body.name,
      description: body.description ?? null,
    }).returning();
    res.status(201).json(CreateRoadmapInitiativeResponse.parse(asJson(initiative)));
  } catch (err) { next(err); }
});

router.patch("/roadmap/initiatives/:id", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const body = initiativeInput.partial().parse(UpdateRoadmapInitiativeBody.parse(req.body));
    if (!Object.keys(body).length) throw new AppError(400, "No initiative fields to update");
    const [initiative] = await db.update(roadmapInitiativesTable).set(body)
      .where(and(eq(roadmapInitiativesTable.id, asId(req.params.id)), eq(roadmapInitiativesTable.userId, req.user!.id)))
      .returning();
    if (!initiative) throw new NotFoundError("Initiative");
    res.json(UpdateRoadmapInitiativeResponse.parse(asJson(initiative)));
  } catch (err) { next(err); }
});

router.delete("/roadmap/initiatives/:id", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const [initiative] = await db.delete(roadmapInitiativesTable)
      .where(and(eq(roadmapInitiativesTable.id, asId(req.params.id)), eq(roadmapInitiativesTable.userId, req.user!.id)))
      .returning();
    if (!initiative) throw new NotFoundError("Initiative");
    DeleteRoadmapInitiativeResponse.parse(undefined);
    res.sendStatus(204);
  } catch (err) { next(err); }
});

router.post("/roadmap/items", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const body = itemInput.parse(CreateRoadmapItemBody.parse(req.body));
    ensureDateRange(body.startDate, body.endDate);
    await Promise.all([
      ensureOwnedOpportunity(body.opportunityId, req.user!.id),
      ensureOwnedInitiative(body.initiativeId, req.user!.id),
    ]);
    const [alreadyAssigned] = await db.select({ id: roadmapItemsTable.id }).from(roadmapItemsTable)
      .where(and(eq(roadmapItemsTable.userId, req.user!.id), eq(roadmapItemsTable.opportunityId, body.opportunityId)));
    if (alreadyAssigned) throw new AppError(409, "This Product Idea is already on the roadmap");
    const [item] = await db.insert(roadmapItemsTable).values({
      userId: req.user!.id,
      initiativeId: body.initiativeId ?? null,
      opportunityId: body.opportunityId,
      startDate: body.startDate,
      endDate: body.endDate,
      status: body.status ?? "planned",
      progress: body.progress ?? 0,
      notes: body.notes ?? null,
    }).returning();
    res.status(201).json(CreateRoadmapItemResponse.parse(asJson(item)));
  } catch (err) { next(err); }
});

router.patch("/roadmap/items/:id", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const itemId = asId(req.params.id);
    const body = itemUpdate.parse(UpdateRoadmapItemBody.parse(req.body));
    if (!Object.keys(body).length) throw new AppError(400, "No roadmap item fields to update");
    const [current] = await db.select().from(roadmapItemsTable)
      .where(and(eq(roadmapItemsTable.id, itemId), eq(roadmapItemsTable.userId, req.user!.id)));
    if (!current) throw new NotFoundError("Roadmap item");
    const startDate = body.startDate ?? current.startDate;
    const endDate = body.endDate ?? current.endDate;
    ensureDateRange(startDate, endDate);
    await Promise.all([
      ensureOwnedInitiative(body.initiativeId, req.user!.id),
      body.opportunityId ? ensureOwnedOpportunity(body.opportunityId, req.user!.id) : Promise.resolve(),
    ]);
    if (body.opportunityId && body.opportunityId !== current.opportunityId) {
      const [assigned] = await db.select({ id: roadmapItemsTable.id }).from(roadmapItemsTable)
        .where(and(eq(roadmapItemsTable.userId, req.user!.id), eq(roadmapItemsTable.opportunityId, body.opportunityId)));
      if (assigned) throw new AppError(409, "This Product Idea is already on the roadmap");
    }
    const [item] = await db.update(roadmapItemsTable).set(body)
      .where(eq(roadmapItemsTable.id, itemId)).returning();
    res.json(UpdateRoadmapItemResponse.parse(asJson(item)));
  } catch (err) { next(err); }
});

router.delete("/roadmap/items/:id", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const [item] = await db.delete(roadmapItemsTable)
      .where(and(eq(roadmapItemsTable.id, asId(req.params.id)), eq(roadmapItemsTable.userId, req.user!.id)))
      .returning();
    if (!item) throw new NotFoundError("Roadmap item");
    DeleteRoadmapItemResponse.parse(undefined);
    res.sendStatus(204);
  } catch (err) { next(err); }
});

router.post("/roadmap/milestones", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const body = milestoneInput.parse(CreateRoadmapMilestoneBody.parse(req.body));
    await ensureOwnedInitiative(body.initiativeId, req.user!.id);
    const [milestone] = await db.insert(roadmapMilestonesTable).values({
      userId: req.user!.id,
      initiativeId: body.initiativeId ?? null,
      name: body.name,
      date: body.date,
      description: body.description ?? null,
    }).returning();
    res.status(201).json(CreateRoadmapMilestoneResponse.parse(asJson(milestone)));
  } catch (err) { next(err); }
});

router.patch("/roadmap/milestones/:id", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const body = milestoneInput.partial().parse(UpdateRoadmapMilestoneBody.parse(req.body));
    if (!Object.keys(body).length) throw new AppError(400, "No milestone fields to update");
    await ensureOwnedInitiative(body.initiativeId, req.user!.id);
    const [milestone] = await db.update(roadmapMilestonesTable).set(body)
      .where(and(eq(roadmapMilestonesTable.id, asId(req.params.id)), eq(roadmapMilestonesTable.userId, req.user!.id)))
      .returning();
    if (!milestone) throw new NotFoundError("Milestone");
    res.json(UpdateRoadmapMilestoneResponse.parse(asJson(milestone)));
  } catch (err) { next(err); }
});

router.delete("/roadmap/milestones/:id", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const [milestone] = await db.delete(roadmapMilestonesTable)
      .where(and(eq(roadmapMilestonesTable.id, asId(req.params.id)), eq(roadmapMilestonesTable.userId, req.user!.id)))
      .returning();
    if (!milestone) throw new NotFoundError("Milestone");
    DeleteRoadmapMilestoneResponse.parse(undefined);
    res.sendStatus(204);
  } catch (err) { next(err); }
});

router.post("/roadmap/proposal", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const ideas = await db.select().from(opportunitiesTable)
      .where(eq(opportunitiesTable.userId, req.user!.id))
      .orderBy(desc(opportunitiesTable.updatedAt))
      .limit(20);
    const ideaIds = ideas.map((idea) => idea.id);
    const [scores, experimentRows] = await Promise.all([
      ideaIds.length
        ? db.select().from(prioritizationScoresTable).where(inArray(prioritizationScoresTable.opportunityId, ideaIds))
          .orderBy(desc(prioritizationScoresTable.createdAt))
        : Promise.resolve([]),
      ideaIds.length
        ? db.select({ experiment: validationExperiments, hypothesis: validationHypotheses })
          .from(validationExperiments)
          .innerJoin(validationHypotheses, eq(validationExperiments.hypothesisId, validationHypotheses.id))
          .where(and(eq(validationExperiments.userId, req.user!.id), inArray(validationHypotheses.opportunityId, ideaIds)))
        : Promise.resolve([]),
    ]);
    const riceByIdea = new Map<number, number | null>();
    for (const score of scores) if (!riceByIdea.has(score.opportunityId)) riceByIdea.set(score.opportunityId, score.riceScore);
    const validationByIdea = new Map<number, string[]>();
    for (const { experiment, hypothesis } of experimentRows) {
      validationByIdea.set(hypothesis.opportunityId, [
        ...(validationByIdea.get(hypothesis.opportunityId) ?? []),
        `${experiment.name}: ${experiment.outcome ?? "no outcome"} (${experiment.pmDecision ?? "no PM decision"})`,
      ]);
    }

    const proposalIdeas = ideas.map((idea) => ({
      id: idea.id,
      title: idea.title,
      category: idea.category,
      urgency: idea.urgency,
      riceScore: riceByIdea.get(idea.id) ?? null,
    }));
    const fallback = defaultProposal(proposalIdeas);
    if (!ideas.length) {
      res.json(GenerateRoadmapProposalResponse.parse({ ...fallback, generatedAt: new Date().toISOString(), source: "no_product_ideas" }));
      return;
    }

    try {
      const contexts = await Promise.all(ideas.map(async (idea) => ({
        id: idea.id,
        context: formatContextForPrompt(await buildProductContext(idea.id)),
        riceScore: riceByIdea.get(idea.id) ?? null,
        validation: validationByIdea.get(idea.id) ?? [],
      })));
      const { openai } = await import("@workspace/integrations-openai-ai-server");
      const response = await openai.chat.completions.create({
        model: "gpt-5.6-luna",
        max_completion_tokens: 2200,
        messages: [{
          role: "user",
          content: `You are a product manager creating an advisory roadmap proposal. Use ONLY the supplied Product Idea, prioritization, and validation context. Do not invent facts. Return only valid JSON in this exact shape:
{"initiatives":[{"name":"string","description":"string","reason":"string","items":[{"opportunityId":number,"sequence":number,"startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","status":"planned|in_progress|completed|at_risk|on_hold","progress":number,"notes":"string","risks":["string"],"why":"string"}]}]}

Rules: Include each opportunity at most once. Use plausible future dates. Treat missing RICE or validation data as a risk, not as a positive signal. The proposal is advisory; do not claim certainty.

CONTEXT:
${contexts.map((entry) => `IDEA ${entry.id} | RICE ${entry.riceScore ?? "unavailable"} | Validation: ${entry.validation.join("; ") || "none"}\n${entry.context}`).join("\n\n---\n\n")}`,
        }],
      });
      const content = response.choices[0]?.message?.content ?? "";
      const parsed = z.object({
        initiatives: z.array(z.object({
          name: z.string().min(1).max(240),
          description: z.string().max(4000),
          reason: z.string().max(4000),
          items: z.array(z.object({
            opportunityId: z.number().int().refine((id) => ideaIds.includes(id)),
            sequence: z.number().int().positive(),
            startDate: dateString,
            endDate: dateString,
            status: roadmapStatus,
            progress: z.number().int().min(0).max(100),
            notes: z.string().max(6000),
            risks: z.array(z.string().max(500)).max(6),
            why: z.string().max(2000),
          })),
        })),
      }).parse(JSON.parse(content.replace(/```json\s*|\s*```/g, "")));
      const used = new Set<number>();
      const safe = {
        initiatives: parsed.initiatives.map((initiative) => ({
          ...initiative,
          items: initiative.items.filter((item) => {
            if (used.has(item.opportunityId) || item.endDate < item.startDate) return false;
            used.add(item.opportunityId);
            return true;
          }),
        })).filter((initiative) => initiative.items.length),
      };
      res.json(GenerateRoadmapProposalResponse.parse({ ...safe, generatedAt: new Date().toISOString(), source: "ai" }));
    } catch {
      res.json(GenerateRoadmapProposalResponse.parse({ ...fallback, generatedAt: new Date().toISOString(), source: "fallback" }));
    }
  } catch (err) { next(err); }
});

export default router;