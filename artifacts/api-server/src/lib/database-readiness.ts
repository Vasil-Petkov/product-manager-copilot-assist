import { recordSecurityFailure, reportDatabaseFailure } from "./security-events.ts";

type Reader = { query(sql: string): Promise<{ rows: Array<Record<string, unknown>> }> };
/** SELECT only. Missing migrations stop startup; never self-heal with DDL. */
export async function verifyDatabaseReadiness(database: Reader): Promise<void> {
  let ready: Record<string, unknown> | undefined;
  try {
    ({ rows: [ready] } = await database.query(`
      SELECT
        (SELECT count(*) = 2 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name IN ('signals','stakeholder_feedback')
          AND column_name = 'user_id' AND is_nullable = 'YES' AND data_type = 'text') AS owners,
        (SELECT count(*) = 2 FROM pg_constraint c
          JOIN pg_namespace n ON n.oid = c.connamespace
          WHERE n.nspname = 'public' AND c.contype = 'f' AND c.confdeltype = 'n'
          AND c.conname IN ('signals_user_id_users_id_fk','stakeholder_feedback_user_id_users_id_fk')
          AND c.confrelid = to_regclass('public.users')) AS foreign_keys,
        (to_regclass('public.conversations_user_idx') IS NOT NULL
          AND to_regclass('public.ai_insights_user_idx') IS NOT NULL
          AND to_regclass('public.security_rate_limits_expiry_idx') IS NOT NULL) AS indexes,
        (SELECT count(*) = 3 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'security_rate_limits'
          AND column_name IN ('bucket_key','hits','expires_at')) AS limiter
    `));
  } catch (error) {
    if (!reportDatabaseFailure(error)) recordSecurityFailure("database_failure");
    throw error;
  }
  if (!ready || Object.values(ready).some((value) => value !== true)) {
    recordSecurityFailure("migration_readiness_failure");
    throw new Error("Required database schema is not ready; use the approved migration flow");
  }
}
