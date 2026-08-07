import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const competitorsTable = pgTable("competitors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  website: text("website"),
  description: text("description"),
  industry: text("industry"),
  notes: text("notes"),
  lastAnalyzedAt: timestamp("last_analyzed_at", { withTimezone: true }),
  latestAnalysis: text("latest_analysis"),
  threatLevel: text("threat_level"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const competitorReportsTable = pgTable("competitor_reports", {
  id: serial("id").primaryKey(),
  competitorId: serial("competitor_id").notNull(),
  summary: text("summary").notNull(),
  newFeatures: text("new_features").array().notNull().default([]),
  pricingChanges: text("pricing_changes"),
  businessImpact: text("business_impact"),
  possibleThreat: text("possible_threat"),
  possibleOpportunity: text("possible_opportunity"),
  recommendation: text("recommendation"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCompetitorSchema = createInsertSchema(competitorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCompetitor = z.infer<typeof insertCompetitorSchema>;
export type Competitor = typeof competitorsTable.$inferSelect;
export type CompetitorReport = typeof competitorReportsTable.$inferSelect;
