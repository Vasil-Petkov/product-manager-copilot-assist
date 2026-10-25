import { and, eq, exists, inArray, isNull, ne, not, or, type AnyColumn } from "drizzle-orm";
import {
  db, opportunitiesTable, feedbackTable, signalsTable, documentsTable,
  validationHypotheses, validationExperiments, roadmapInitiativesTable,
  roadmapItemsTable, roadmapMilestonesTable,
} from "@workspace/db";
import { NotFoundError } from "../middlewares/errorHandler";

export function ownedIdeaIds(userId: string) {
  return db.select({ id: opportunitiesTable.id }).from(opportunitiesTable)
    .where(eq(opportunitiesTable.userId, userId));
}

// Explicit owner must agree with the parent. A null owner may inherit an
// existing, authoritative FK relationship, but unlinked legacy data stays hidden.
function ownedEvidence(owner: AnyColumn, parent: AnyColumn, userId: string) {
  return and(
    or(eq(owner, userId), isNull(owner)),
    or(
      and(eq(owner, userId), isNull(parent)),
      inArray(parent, ownedIdeaIds(userId)),
    ),
  )!;
}

export function ownedFeedback(userId: string) {
  return ownedEvidence(feedbackTable.userId, feedbackTable.opportunityId, userId);
}

export function ownedSignal(userId: string) {
  return ownedEvidence(signalsTable.userId, signalsTable.opportunityId, userId);
}

export async function requireOwnedIdea(id: number, userId: string) {
  const [idea] = await db.select().from(opportunitiesTable)
    .where(and(eq(opportunitiesTable.id, id), eq(opportunitiesTable.userId, userId)));
  if (!idea) throw new NotFoundError("Product Idea");
  return idea;
}

export function ownedHypothesis(userId: string) {
  return and(eq(validationHypotheses.userId, userId), inArray(validationHypotheses.opportunityId, ownedIdeaIds(userId)))!;
}

export function ownedExperiment(userId: string) {
  return and(
    eq(validationExperiments.userId, userId),
    inArray(validationExperiments.hypothesisId,
      db.select({ id: validationHypotheses.id }).from(validationHypotheses).where(ownedHypothesis(userId))),
  )!;
}

export function ownedDocument(userId: string) {
  return and(eq(documentsTable.userId, userId), inArray(documentsTable.productIdeaId, ownedIdeaIds(userId)))!;
}

function ownedInitiativeOrUnassigned(initiativeId: AnyColumn, userId: string) {
  return or(isNull(initiativeId), inArray(initiativeId,
    db.select({ id: roadmapInitiativesTable.id }).from(roadmapInitiativesTable)
      .where(eq(roadmapInitiativesTable.userId, userId))))!;
}

export function ownedRoadmapItem(userId: string) {
  return and(
    eq(roadmapItemsTable.userId, userId),
    inArray(roadmapItemsTable.opportunityId, ownedIdeaIds(userId)),
    ownedInitiativeOrUnassigned(roadmapItemsTable.initiativeId, userId),
  )!;
}

export function ownedRoadmapMilestone(userId: string) {
  return and(eq(roadmapMilestonesTable.userId, userId),
    ownedInitiativeOrUnassigned(roadmapMilestonesTable.initiativeId, userId))!;
}

// Do not let cascades or SET NULL turn inconsistent foreign children into
// accessible records, or delete another user's data. Such legacy links need
// explicit administrative review, not automatic reassignment.
export function safeIdeaDeletion(userId: string) {
  return and(
    not(exists(db.select({ id: feedbackTable.id }).from(feedbackTable)
      .where(and(eq(feedbackTable.opportunityId, opportunitiesTable.id), ne(feedbackTable.userId, userId))))),
    not(exists(db.select({ id: signalsTable.id }).from(signalsTable)
      .where(and(eq(signalsTable.opportunityId, opportunitiesTable.id), ne(signalsTable.userId, userId))))),
    not(exists(db.select({ id: documentsTable.id }).from(documentsTable)
      .where(and(eq(documentsTable.productIdeaId, opportunitiesTable.id), ne(documentsTable.userId, userId))))),
    not(exists(db.select({ id: roadmapItemsTable.id }).from(roadmapItemsTable)
      .where(and(eq(roadmapItemsTable.opportunityId, opportunitiesTable.id), ne(roadmapItemsTable.userId, userId))))),
    not(exists(db.select({ id: validationHypotheses.id }).from(validationHypotheses)
      .where(and(eq(validationHypotheses.opportunityId, opportunitiesTable.id), ne(validationHypotheses.userId, userId))))),
    not(exists(db.select({ id: validationExperiments.id }).from(validationExperiments)
      .innerJoin(validationHypotheses, eq(validationExperiments.hypothesisId, validationHypotheses.id))
      .where(and(eq(validationHypotheses.opportunityId, opportunitiesTable.id), ne(validationExperiments.userId, userId))))),
  )!;
}

export function safeInitiativeDeletion(userId: string) {
  return and(
    not(exists(db.select({ id: roadmapItemsTable.id }).from(roadmapItemsTable)
      .where(and(eq(roadmapItemsTable.initiativeId, roadmapInitiativesTable.id), ne(roadmapItemsTable.userId, userId))))),
    not(exists(db.select({ id: roadmapMilestonesTable.id }).from(roadmapMilestonesTable)
      .where(and(eq(roadmapMilestonesTable.initiativeId, roadmapInitiativesTable.id), ne(roadmapMilestonesTable.userId, userId))))),
  )!;
}
