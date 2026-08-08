import { pgTable, text, serial, timestamp, real, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { opportunitiesTable } from "./opportunities";

// Fixed: opportunity_id was serial (auto-increment type) — now proper integer FK
export const prioritizationScoresTable = pgTable("prioritization_scores", {
  id: serial("id").primaryKey(),
  opportunityId: integer("opportunity_id").notNull().references(() => opportunitiesTable.id, { onDelete: "cascade" }),
  framework: text("framework").notNull(),
  riceReach: real("rice_reach"),
  riceImpact: real("rice_impact"),
  riceConfidence: real("rice_confidence"),
  riceEffort: real("rice_effort"),
  riceScore: real("rice_score"),
  iceImpact: real("ice_impact"),
  iceConfidence: real("ice_confidence"),
  iceEase: real("ice_ease"),
  iceScore: real("ice_score"),
  moscowCategory: text("moscow_category"),
  kanoCategory: text("kano_category"),
  aiReasoning: text("ai_reasoning"),
  manualOverride: boolean("manual_override").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPrioritizationScoreSchema = createInsertSchema(prioritizationScoresTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPrioritizationScore = z.infer<typeof insertPrioritizationScoreSchema>;
export type PrioritizationScore = typeof prioritizationScoresTable.$inferSelect;
