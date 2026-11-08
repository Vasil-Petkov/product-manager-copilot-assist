import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Counter metadata only: no cookies, tokens, user IDs, raw IPs or demo content.
export const securityRateLimitsTable = pgTable("security_rate_limits", {
  bucketKey: text("bucket_key").primaryKey(),
  hits: integer("hits").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [index("security_rate_limits_expiry_idx").on(table.expiresAt)]);
