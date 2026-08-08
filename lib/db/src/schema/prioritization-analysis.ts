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

  // ── Top-level scalars for fast sorting ──────────────────────────────────────
  riceScore:         real("rice_score"),
  iceScore:          real("ice_score"),
  weightedScore:     real("weighted_score"),
  opportunityScore:  real("opportunity_score"),
  moscowCategory:    text("moscow_category"),
  kanoCategory:      text("kano_category"),
  vveQuadrant:       text("vve_quadrant"),

  // ── Per-framework detail blobs (JSONB) ──────────────────────────────────────
  riceData:         jsonb("rice_data"),       // reach, impactLabel, impactValue, confidence, effortPoints, score, explanation
  iceData:          jsonb("ice_data"),        // impact, confidence, ease, score, explanation
  moscowData:       jsonb("moscow_data"),     // category, explanation
  weightedData:     jsonb("weighted_data"),   // 6 criteria scores, final score, explanation
  vveData:          jsonb("vve_data"),        // businessValue, engineeringEffort, quadrant, explanation
  kanoData:         jsonb("kano_data"),       // category, explanation
  opportunityData:  jsonb("opportunity_data"), // importance, satisfaction, score, explanation
  engineeringData:  jsonb("engineering_data"), // per-component SP, totalStoryPoints, estimatedDays, sprintCount, complexity, confidence
  businessContext:  jsonb("business_context"), // customerCount, arrImpact, revenueOpportunity, retentionImpact, …
  executiveData:    jsonb("executive_data"),  // score (0-100), confidence, whyBuildNext, businessImpact, customerImpact, engineering, risks, expectedROI

  analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
  createdAt:  timestamp("created_at",  { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp("updated_at",  { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type PrioritizationAnalysis = typeof prioritizationAnalysisTable.$inferSelect;
