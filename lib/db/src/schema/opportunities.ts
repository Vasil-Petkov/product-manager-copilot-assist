import { pgTable, text, serial, timestamp, real, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const opportunitiesTable = pgTable("opportunities", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category"),
  sourceType: text("source_type").notNull().default("manual"),
  originalContent: text("original_content"),
  aiSummary: text("ai_summary"),
  customerProblem: text("customer_problem"),
  suggestedSolution: text("suggested_solution"),
  businessValue: text("business_value"),
  estimatedCustomerImpact: text("estimated_customer_impact"),
  estimatedBusinessImpact: text("estimated_business_impact"),
  urgency: text("urgency"),
  confidenceScore: real("confidence_score"),
  sentiment: text("sentiment"),
  tags: text("tags").array().notNull().default([]),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOpportunitySchema = createInsertSchema(opportunitiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type Opportunity = typeof opportunitiesTable.$inferSelect;
