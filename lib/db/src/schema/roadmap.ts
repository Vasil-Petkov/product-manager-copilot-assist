import {
  date,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";
import { opportunitiesTable } from "./opportunities";

export const roadmapInitiativesTable = pgTable(
  "roadmap_initiatives",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 240 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [index("roadmap_initiatives_user_idx").on(table.userId)],
);

export const roadmapItemsTable = pgTable(
  "roadmap_items",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    initiativeId: integer("initiative_id").references(() => roadmapInitiativesTable.id, { onDelete: "set null" }),
    opportunityId: integer("opportunity_id").notNull().references(() => opportunitiesTable.id, { onDelete: "cascade" }),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("planned"),
    progress: integer("progress").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("roadmap_items_user_idx").on(table.userId),
    index("roadmap_items_initiative_idx").on(table.initiativeId),
    uniqueIndex("roadmap_items_user_opportunity_idx").on(table.userId, table.opportunityId),
  ],
);

export const roadmapMilestonesTable = pgTable(
  "roadmap_milestones",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    initiativeId: integer("initiative_id").references(() => roadmapInitiativesTable.id, { onDelete: "set null" }),
    name: varchar("name", { length: 240 }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("roadmap_milestones_user_idx").on(table.userId),
    index("roadmap_milestones_initiative_idx").on(table.initiativeId),
  ],
);

export const insertRoadmapInitiativeSchema = createInsertSchema(roadmapInitiativesTable)
  .omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export const insertRoadmapItemSchema = createInsertSchema(roadmapItemsTable)
  .omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export const insertRoadmapMilestoneSchema = createInsertSchema(roadmapMilestonesTable)
  .omit({ id: true, userId: true, createdAt: true, updatedAt: true });

export type RoadmapInitiative = typeof roadmapInitiativesTable.$inferSelect;
export type RoadmapItem = typeof roadmapItemsTable.$inferSelect;
export type RoadmapMilestone = typeof roadmapMilestonesTable.$inferSelect;
export type InsertRoadmapInitiative = z.infer<typeof insertRoadmapInitiativeSchema>;
export type InsertRoadmapItem = z.infer<typeof insertRoadmapItemSchema>;
export type InsertRoadmapMilestone = z.infer<typeof insertRoadmapMilestoneSchema>;