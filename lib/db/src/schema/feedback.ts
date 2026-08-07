import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const feedbackTable = pgTable("stakeholder_feedback", {
  id: serial("id").primaryKey(),
  department: text("department").notNull(),
  stakeholderName: text("stakeholder_name").notNull(),
  description: text("description").notNull(),
  customerImpact: text("customer_impact"),
  businessContext: text("business_context"),
  urgency: text("urgency"),
  opportunityId: text("opportunity_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFeedbackSchema = createInsertSchema(feedbackTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type StakeholderFeedback = typeof feedbackTable.$inferSelect;
