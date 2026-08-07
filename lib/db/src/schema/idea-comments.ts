import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { opportunitiesTable } from "./opportunities";

export const ideaCommentsTable = pgTable("idea_comments", {
  id: serial("id").primaryKey(),
  ideaId: integer("idea_id").notNull().references(() => opportunitiesTable.id, { onDelete: "cascade" }),
  author: text("author").notNull().default("PM"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type IdeaComment = typeof ideaCommentsTable.$inferSelect;
