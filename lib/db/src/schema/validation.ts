import { date, index, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { opportunitiesTable } from "./opportunities";
import { usersTable } from "./auth";

/**
 * validation_hypotheses
 *
 * Core anchor entity for the Validation module.
 * Each hypothesis belongs to a Product Idea (opportunity) and is owned by a user.
 *
 * Phase 1: table created as architectural foundation.
 * Phase 2: full hypothesis CRUD, Product Idea context, and AI-assisted wording.
 *
 * Relationship:
 *   opportunities (1) ──── (*) validation_hypotheses
 *   validation_hypotheses (1) ──── (*) validation_experiments
 *
 * Validation entities must NEVER duplicate Product Idea data — they reference it
 * via opportunityId. Prioritization scores (RICE, ICE, MoSCoW, …) live in
 * prioritization_analysis and are joined by opportunityId when needed.
 */
export const validationHypotheses = pgTable(
  "validation_hypotheses",
  {
    id: serial("id").primaryKey(),
    opportunityId: integer("opportunity_id")
      .notNull()
      .references(() => opportunitiesTable.id, { onDelete: "cascade" }),

    // Server-owned. Never accepted from a client payload.
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    hypothesisType: varchar("hypothesis_type", { length: 32 })
      .notNull()
      .default("custom"),
    statement: text("statement").notNull(),
    assumption: text("assumption"),
    successCriteria: text("success_criteria"),
    status: varchar("status", { length: 32 }).notNull().default("draft"),
    notes: text("notes"),

    // Kept separate from the PM-authored/final statement. AI never overwrites it.
    aiSuggestion: text("ai_suggestion"),

    // Soft archive: records remain available for audit/history.
    archivedAt: timestamp("archived_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("validation_hypotheses_user_idx").on(table.userId),
    index("validation_hypotheses_opportunity_idx").on(table.opportunityId),
  ],
);

export type ValidationHypothesis     = typeof validationHypotheses.$inferSelect;
export type NewValidationHypothesis  = typeof validationHypotheses.$inferInsert;

/**
 * validation_experiments
 *
 * An execution plan for one owned hypothesis. Product Idea and prioritization
 * context remain linked through the hypothesis and are never copied here.
 */
export const validationExperiments = pgTable(
  "validation_experiments",
  {
    id: serial("id").primaryKey(),
    hypothesisId: integer("hypothesis_id")
      .notNull()
      .references(() => validationHypotheses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 300 }).notNull(),
    methodKey: varchar("method_key", { length: 64 }).notNull(),
    setup: text("setup"),
    targetAudience: text("target_audience"),
    successMeasures: text("success_measures"),
    actualResult: text("actual_result"),
    outcome: varchar("outcome", { length: 32 }),
    pmDecision: varchar("pm_decision", { length: 32 }),
    pmNotes: text("pm_notes"),
    resultEnteredAt: timestamp("result_entered_at", { withTimezone: true }),
    status: varchar("status", { length: 32 }).notNull().default("draft"),

    // Calendar dates intentionally remain timezone-free YYYY-MM-DD values.
    plannedStartDate: date("planned_start_date", { mode: "string" }),
    plannedEndDate: date("planned_end_date", { mode: "string" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("validation_experiments_user_idx").on(table.userId),
    index("validation_experiments_hypothesis_idx").on(table.hypothesisId),
    index("validation_experiments_status_idx").on(table.status),
  ],
);

export type ValidationExperiment = typeof validationExperiments.$inferSelect;
export type NewValidationExperiment = typeof validationExperiments.$inferInsert;
