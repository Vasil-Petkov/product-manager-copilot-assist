import { Router, type IRouter } from "express";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import {
  db,
  documentsTable,
  opportunitiesTable,
  type Document as DbDocument,
} from "@workspace/db";
import {
  AcceptDocumentParams,
  AcceptDocumentBody,
  AcceptDocumentResponse,
  GenerateDocumentBody,
  GenerateDocumentResponse,
  GetDocumentParams,
  GetDocumentResponse,
  GetDocumentContextParams,
  GetDocumentContextResponse,
  ListDocumentsQueryParams,
  ListDocumentsResponse,
  RegenerateDocumentBody,
  RegenerateDocumentParams,
  RegenerateDocumentResponse,
  UpdateDocumentBody,
  UpdateDocumentParams,
  UpdateDocumentResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { AppError, NotFoundError, ValidationError } from "../middlewares/errorHandler";
import { buildProductContext } from "../services/contextEngine";
import { generateDocument } from "../services/documentGeneration";
import { buildDocumentationAiContext } from "../services/documentationContext";

const router: IRouter = Router();

function responseDocument(document: DbDocument): DbDocument {
  return document;
}

async function getOwnedDocument(id: number, userId: string): Promise<DbDocument | undefined> {
  const [document] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, id), eq(documentsTable.userId, userId)));
  return document;
}

async function getOwnedProductIdea(id: number, userId: string) {
  const [idea] = await db
    .select()
    .from(opportunitiesTable)
    .where(and(eq(opportunitiesTable.id, id), eq(opportunitiesTable.userId, userId)));
  return idea;
}

async function getAcceptedDocument(productIdeaId: number, documentType: string): Promise<DbDocument | undefined> {
  const [document] = await db
    .select()
    .from(documentsTable)
    .where(and(
      eq(documentsTable.productIdeaId, productIdeaId),
      eq(documentsTable.documentType, documentType),
      eq(documentsTable.status, "accepted"),
    ))
    .limit(1);
  return document;
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const databaseError = error as { code?: unknown; cause?: unknown };
  if (databaseError.code === "23505") return true;
  if (typeof databaseError.cause !== "object" || databaseError.cause === null) return false;
  return (databaseError.cause as { code?: unknown }).code === "23505";
}

async function generatedDocument(productIdeaId: number, documentType: string, userId: string) {
  const context = await getOwnedDocumentationContext(productIdeaId, documentType, userId);
  return generateDocument(documentType, context);
}

async function getOwnedDocumentationContext(productIdeaId: number, documentType: string, userId: string) {
  const idea = await getOwnedProductIdea(productIdeaId, userId);
  if (!idea) throw new NotFoundError("Product Idea");
  const context = await buildProductContext(productIdeaId, userId);
  return buildDocumentationAiContext(context, documentType);
}

router.get("/documents", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const query = ListDocumentsQueryParams.parse(req.query);
    const conditions = [eq(documentsTable.userId, req.user!.id)];
    if (query.productIdeaId !== undefined) conditions.push(eq(documentsTable.productIdeaId, query.productIdeaId));
    if (query.documentType) conditions.push(eq(documentsTable.documentType, query.documentType));
    if (query.status) conditions.push(eq(documentsTable.status, query.status));
    const documents = await db
      .select()
      .from(documentsTable)
      .where(and(...conditions))
      .orderBy(desc(documentsTable.updatedAt));
    res.json(ListDocumentsResponse.parse(documents.map(responseDocument)));
  } catch (error) {
    next(error);
  }
});

router.post("/documents/generate", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const body = GenerateDocumentBody.parse(req.body);
    const generated = await generatedDocument(body.productIdeaId, body.documentType, req.user!.id);
    const [document] = await db
      .insert(documentsTable)
      .values({
        productIdeaId: body.productIdeaId,
        userId: req.user!.id,
        documentType: body.documentType,
        status: "ai_generated",
        title: generated.title,
        content: generated.content,
        generationMetadata: generated.generationMetadata,
        humanEdited: false,
      })
      .returning();
    res.status(201).json(GenerateDocumentResponse.parse(responseDocument(document!)));
  } catch (error) {
    next(error);
  }
});

router.get("/documents/:id", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const { id } = GetDocumentParams.parse(req.params);
    const document = await getOwnedDocument(id, req.user!.id);
    if (!document) throw new NotFoundError("Document");
    res.json(GetDocumentResponse.parse(responseDocument(document)));
  } catch (error) {
    next(error);
  }
});

router.get("/documents/context/:productIdeaId/:documentType", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const { productIdeaId, documentType } = GetDocumentContextParams.parse(req.params);
    const context = await getOwnedDocumentationContext(productIdeaId, documentType, req.user!.id);
    res.json(GetDocumentContextResponse.parse(context));
  } catch (error) {
    next(error);
  }
});

router.patch("/documents/:id", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const { id } = UpdateDocumentParams.parse(req.params);
    const body = UpdateDocumentBody.parse(req.body);
    if (body.title === undefined && body.content === undefined) {
      throw new ValidationError("At least one document field is required");
    }
    const existing = await getOwnedDocument(id, req.user!.id);
    if (!existing) throw new NotFoundError("Document");
    if (existing.status === "accepted") {
      throw new AppError(409, "Accepted documents cannot be edited", "DOCUMENT_ACCEPTED");
    }
    const values: { title?: string; content?: string; status: "in_review"; humanEdited: true } = {
      status: "in_review",
      humanEdited: true,
    };
    if (body.title !== undefined) {
      if (!body.title.trim()) throw new ValidationError("Document title cannot be empty");
      values.title = body.title.trim();
    }
    if (body.content !== undefined) {
      if (!body.content.trim()) throw new ValidationError("Document content cannot be empty");
      values.content = body.content;
    }
    const [document] = await db
      .update(documentsTable)
      .set({ ...values, revision: sql`${documentsTable.revision} + 1` })
      .where(and(
        eq(documentsTable.id, id),
        eq(documentsTable.userId, req.user!.id),
        ne(documentsTable.status, "accepted"),
        eq(documentsTable.revision, body.expectedRevision),
      ))
      .returning();
    if (!document) throw new AppError(409, "Document was changed and is no longer editable", "DOCUMENT_CONFLICT");
    res.json(UpdateDocumentResponse.parse(responseDocument(document)));
  } catch (error) {
    next(error);
  }
});

router.post("/documents/:id/regenerate", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const { id } = RegenerateDocumentParams.parse(req.params);
    const body = RegenerateDocumentBody.parse(req.body);
    if (!body.confirmReplace) throw new ValidationError("confirmReplace must be true to regenerate a document");
    const existing = await getOwnedDocument(id, req.user!.id);
    if (!existing) throw new NotFoundError("Document");
    if (existing.status === "accepted") {
      throw new AppError(409, "Accepted documents cannot be regenerated", "DOCUMENT_ACCEPTED");
    }
    const generated = await generatedDocument(existing.productIdeaId, existing.documentType, req.user!.id);
    const [document] = await db
      .update(documentsTable)
      .set({
        status: "ai_generated",
        title: generated.title,
        content: generated.content,
        generationMetadata: generated.generationMetadata,
        humanEdited: false,
        revision: sql`${documentsTable.revision} + 1`,
      })
      .where(and(
        eq(documentsTable.id, id),
        eq(documentsTable.userId, req.user!.id),
        ne(documentsTable.status, "accepted"),
        eq(documentsTable.revision, body.expectedRevision),
      ))
      .returning();
    if (!document) throw new AppError(409, "Document was accepted while regenerating", "DOCUMENT_CONFLICT");
    res.json(RegenerateDocumentResponse.parse(responseDocument(document)));
  } catch (error) {
    next(error);
  }
});

router.post("/documents/:id/accept", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const { id } = AcceptDocumentParams.parse(req.params);
    const body = AcceptDocumentBody.parse(req.body);
    const existing = await getOwnedDocument(id, req.user!.id);
    if (!existing) throw new NotFoundError("Document");
    if (!existing.content.trim()) throw new ValidationError("Document content cannot be empty");
    if (existing.status === "accepted") {
      if (
        existing.revision === body.expectedRevision + 1 &&
        existing.acceptedBy === req.user!.id &&
        existing.acceptedAt !== null
      ) {
        res.json(AcceptDocumentResponse.parse(responseDocument(existing)));
        return;
      }
      throw new AppError(409, "Document was already accepted at a different revision", "DOCUMENT_CONFLICT");
    }
    const acceptedDocument = await getAcceptedDocument(existing.productIdeaId, existing.documentType);
    if (acceptedDocument) {
      throw new AppError(409, "An accepted document already exists for this Product Idea and type", "DUPLICATE_ACCEPTED_DOCUMENT");
    }
    try {
      const [document] = await db
        .update(documentsTable)
        .set({
          status: "accepted",
          acceptedAt: new Date(),
          acceptedBy: req.user!.id,
          revision: sql`${documentsTable.revision} + 1`,
        })
        .where(and(
          eq(documentsTable.id, id),
          eq(documentsTable.userId, req.user!.id),
          ne(documentsTable.status, "accepted"),
           eq(documentsTable.revision, body.expectedRevision),
        ))
        .returning();
      if (!document) throw new AppError(409, "Document was changed and cannot be accepted", "DOCUMENT_CONFLICT");
      res.json(AcceptDocumentResponse.parse(responseDocument(document)));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(409, "An accepted document already exists for this Product Idea and type", "DUPLICATE_ACCEPTED_DOCUMENT");
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

export default router;