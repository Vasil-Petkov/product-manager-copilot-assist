import { pgTable, serial, integer, real, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { opportunitiesTable } from "./opportunities";

/**
 * One row per Product Idea.
 * Stores all 7 framework scores + engineering estimate + business context + executive recommendation.
 * Computed once per "Analyze" trigger; re-running overwrites the row (upsert by opportunityId).
 */
export const prioritizationAnalysisTable = pgTable("prioritization_analysis", {
  id: serial("id").primaryKey(),
  opportunityId: integer("opportunity_id")
    .notNull()
    .unique()
    .references(() => opportunitiesTable.id, { onDelete: "cascade" }),

  riceScore: real("rice_score"),
  iceScore: real("ice_score"),
  weightedScore: real("weighted_score"),
  opportunityScore: real("opportunity_score"),
  moscowCategory: text("moscow_category"),
  kanoCategory: text("kano_category"),
  vveQuadrant: text("vve_quadrant"),

  riceData: jsonb("rice_data"),
  iceData: jsonb("ice_data"),
  moscowData: jsonb("moscow_data"),
  weightedData: jsonb("weighted_data"),
  vveData: jsonb("vve_data"),
  kanoData: jsonb("kano_data"),
  opportunityData: jsonb("opportunity_data"),
  engineeringData: jsonb("engineering_data"),
  businessContext: jsonb("business_context"),
  executiveData: jsonb("executive_data"),

  analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type PrioritizationAnalysis = typeof prioritizationAnalysisTable.$inferSelect;