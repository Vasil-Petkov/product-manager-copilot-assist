import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { opportunitiesTable } from "./opportunities";
import { meetingsTable } from "./meetings";
import { competitorsTable } from "./competitors";

export const ideaMeetingsTable = pgTable("idea_meetings", {
  id: serial("id").primaryKey(),
  ideaId: integer("idea_id").notNull().references(() => opportunitiesTable.id, { onDelete: "cascade" }),
  meetingId: integer("meeting_id").notNull().references(() => meetingsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ideaCompetitorsTable = pgTable("idea_competitors", {
  id: serial("id").primaryKey(),
  ideaId: integer("idea_id").notNull().references(() => opportunitiesTable.id, { onDelete: "cascade" }),
  competitorId: integer("competitor_id").notNull().references(() => competitorsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type IdeaMeeting = typeof ideaMeetingsTable.$inferSelect;
export type IdeaCompetitor = typeof ideaCompetitorsTable.$inferSelect;
