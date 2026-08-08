import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { opportunitiesTable } from "./opportunities";

export const ideaTimelineTable = pgTable("idea_timeline", {
  id: serial("id").primaryKey(),
  ideaId: integer("idea_id").notNull().references(() => opportunitiesTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // e.g. "created", "analyzed", "comment_added", "meeting_linked", "status_changed"
  description: text("description").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type IdeaTimelineEvent = typeof ideaTimelineTable.$inferSelect;
