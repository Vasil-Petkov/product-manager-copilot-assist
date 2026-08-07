import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const signalsTable = pgTable("signals", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  sourceType: text("source_type").notNull(),
  sourcePlatform: text("source_platform"),
  author: text("author"),
  sourceUrl: text("source_url"),
  votes: text("votes"),
  customerId: text("customer_id"),
  sentiment: text("sentiment"),
  processed: boolean("processed").notNull().default(false),
  opportunityId: text("opportunity_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSignalSchema = createInsertSchema(signalsTable).omit({ id: true, createdAt: true });
export type InsertSignal = z.infer<typeof insertSignalSchema>;
export type Signal = typeof signalsTable.$inferSelect;
