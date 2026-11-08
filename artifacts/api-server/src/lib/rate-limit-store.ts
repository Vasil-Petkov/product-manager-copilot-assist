export interface Bucket { key: string; limit: number; windowMs: number }
export interface RateLimitStore {
  consume(buckets: Bucket[]): Promise<{ allowed: boolean; retryAfter: number }>;
}
interface SqlClient {
  query(text: string, values: unknown[]): Promise<{ rows: Array<{ bucket_key: string; hits: number; retry_after: number }> }>;
}

/** Atomic counters shared by all Autoscale instances. Never creates schema. */
export class PostgresRateLimitStore implements RateLimitStore {
  constructor(private client: SqlClient) {}
  async consume(buckets: Bucket[]) {
    if (buckets.length === 0) throw new Error("Empty rate limit policy");
    // Separate autocommit statement: cleanup locks cannot deadlock against an
    // upsert holding a different counter lock. No application records touched.
    await this.client.query(`
      DELETE FROM security_rate_limits WHERE bucket_key IN (
        SELECT bucket_key FROM security_rate_limits
        WHERE expires_at <= CURRENT_TIMESTAMP
        ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED
      )
    `, []);
    const result = await this.client.query(`
      INSERT INTO security_rate_limits AS counters (bucket_key, hits, expires_at)
      SELECT key, 1, CURRENT_TIMESTAMP + duration * INTERVAL '1 millisecond'
      FROM unnest($1::text[], $2::integer[]) AS input(key, duration)
      ORDER BY key
      ON CONFLICT (bucket_key) DO UPDATE SET
        hits = CASE WHEN counters.expires_at <= CURRENT_TIMESTAMP THEN 1 ELSE LEAST(counters.hits + 1, 1000000) END,
        expires_at = CASE WHEN counters.expires_at <= CURRENT_TIMESTAMP THEN EXCLUDED.expires_at ELSE counters.expires_at END
      RETURNING bucket_key, hits,
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP))))::integer AS retry_after
    `, [buckets.map((b) => b.key), buckets.map((b) => b.windowMs)]);
    if (result.rows.length !== buckets.length) throw new Error("Incomplete rate counter result");
    let retryAfter = 0;
    for (const row of result.rows) {
      const bucket = buckets.find((b) => b.key === row.bucket_key);
      if (!bucket) throw new Error("Unexpected rate counter result");
      if (row.hits > bucket.limit) retryAfter = Math.max(retryAfter, row.retry_after);
    }
    return { allowed: retryAfter === 0, retryAfter };
  }
}
