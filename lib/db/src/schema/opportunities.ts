import { pgTable, text, serial, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const opportunitiesTable = pgTable("opportunities", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category"),
  sourceType: text("source_type").notNull().default("manual"),
  originalContent: text("original_content"),
  // AI Analysis fields
  aiSummary: text("ai_summary"),
  problemStatement: text("problem_statement"),
  rootCause: text("root_cause"),
  customerProblem: text("customer_problem"),
  suggestedSolution: text("suggested_solution"),
  businessValue: text("business_value"),
  customerValue: text("customer_value"),
  estimatedCustomerImpact: text("estimated_customer_impact"),
  estimatedBusinessImpact: text("estimated_business_impact"),
  dependencies: text("dependencies"),
  aiRecommendation: text("ai_recommendation"),
  openQuestions: text("open_questions").array().notNull().default([]),
  // Scoring & status
  urgency: text("urgency"),
  confidenceScore: real("confidence_score"),
  healthScore: real("health_score"),
  sentiment: text("sentiment"),
  // Metadata
  tags: text("tags").array().notNull().default([]),
  status: text("status").notNull().default("new"),
  owner: text("owner"),
  // Ownership — FK to users (nullable for backwards compat with pre-auth data)
  userId: text("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOpportunitySchema = createInsertSchema(opportunitiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type Opportunity = typeof opportunitiesTable.$inferSelect;
