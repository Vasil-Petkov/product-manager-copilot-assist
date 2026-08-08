import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { opportunitiesTable } from "./opportunities";

export const signalsTable = pgTable("signals", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  sourceType: text("source_type").notNull(),
  sourcePlatform: text("source_platform"),
  author: text("author"),
  sourceUrl: text("source_url"),
  votes: integer("votes"),
  customerId: text("customer_id"),
  sentiment: text("sentiment"),
  processed: boolean("processed").notNull().default(false),
  // Proper FK reference — was text before (data integrity fix)
  opportunityId: integer("opportunity_id").references(() => opportunitiesTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSignalSchema = createInsertSchema(signalsTable).omit({ id: true, createdAt: true });
export type InsertSignal = z.infer<typeof insertSignalSchema>;
export type Signal = typeof signalsTable.$inferSelect;
