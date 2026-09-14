import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";
import { opportunitiesTable } from "./opportunities";

export const documentStatuses = ["draft", "ai_generated", "in_review", "accepted"] as const;
export const documentTypes = [
  "mrd", "brd", "business_case", "use_case", "prd", "initiative", "epic",
  "user_story", "acceptance_criteria", "definition_of_ready", "definition_of_done",
  "functional_requirements", "nonfunctional_requirements", "technical_requirements",
  "release_notes", "stakeholder_updates",
] as const;

export type DocumentStatus = (typeof documentStatuses)[number];
export type DocumentType = (typeof documentTypes)[number];

export type DocumentGenerationMetadata = {
  promptVersion: string;
  model: string;
  generatedAt: string;
  contextSummary: string;
};

export const documentsTable = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    productIdeaId: integer("product_idea_id").notNull().references(() => opportunitiesTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    documentType: varchar("document_type", { length: 64 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("draft"),
    title: text("title").notNull(),
    content: text("content").notNull(),
    generationMetadata: jsonb("generation_metadata").$type<DocumentGenerationMetadata | null>(),
    humanEdited: boolean("human_edited").notNull().default(false),
    revision: integer("revision").notNull().default(1),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedBy: text("accepted_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("documents_user_idx").on(table.userId),
    index("documents_product_idea_idx").on(table.productIdeaId),
    index("documents_user_product_type_idx").on(table.userId, table.productIdeaId, table.documentType),
    uniqueIndex("documents_one_accepted_idx")
      .on(table.productIdeaId, table.documentType)
      .where(sql`${table.status} = 'accepted'`),
    check("documents_status_valid", sql`${table.status} in ('draft', 'ai_generated', 'in_review', 'accepted')`),
    check("documents_type_valid", sql`${table.documentType} in ('mrd', 'brd', 'business_case', 'use_case', 'prd', 'initiative', 'epic', 'user_story', 'acceptance_criteria', 'definition_of_ready', 'definition_of_done', 'functional_requirements', 'nonfunctional_requirements', 'technical_requirements', 'release_notes', 'stakeholder_updates')`),
  ],
);

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;