import { pgTable, text, serial, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const meetingsTable = pgTable("meetings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  meetingDate: timestamp("meeting_date", { withTimezone: true }).notNull(),
  attendees: text("attendees").array().notNull().default([]),
  transcript: text("transcript"),
  notes: text("notes"),
  analyzed: boolean("analyzed").notNull().default(false),
  opportunitiesExtracted: text("opportunities_extracted").notNull().default("0"),
  extractedInsights: jsonb("extracted_insights"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMeetingSchema = createInsertSchema(meetingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetingsTable.$inferSelect;
