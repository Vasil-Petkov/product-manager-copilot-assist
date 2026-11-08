import { writeSync } from "node:fs";
import { DrizzleQueryError } from "drizzle-orm";
type Failure = "database_failure" | "migration_readiness_failure" | "startup_failure";
type Event = "csrf_rejected" | "cors_rejected" | "rate_allowed" | "rate_limited" | "rate_store_unavailable" | "demo_capacity" | "auth_callback_error" | Failure;
type Metric = { event: "security_metrics"; windowSeconds: number; counters: Array<{ name: Event; policy: string; count: number }> };
type Sink = (metric: Metric) => void;
const events = new Set(["csrf_rejected", "cors_rejected", "rate_allowed", "rate_limited", "rate_store_unavailable", "demo_capacity", "auth_callback_error", "database_failure", "migration_readiness_failure", "startup_failure"]);
const policies = new Set(["all", "auth", "authRead", "demoCreate", "demoRead", "demoExit", "generation", "analysis", "chat"]);

/** Bounded labels only: never accept request data, IDs, tokens or raw paths. */
export class SecurityMetrics {
  private counters = new Map<string, { name: Event; policy: string; count: number }>();
  constructor(private sink: (metric: Metric) => void) {}
  record(name: Event, policy = "all") {
    if (!events.has(name)) throw new Error("Unknown security event");
    if (!policies.has(policy)) throw new Error("Unknown security metric policy");
    const key = `${name}:${policy}`;
    const current = this.counters.get(key);
    if (current) current.count++;
    else this.counters.set(key, { name, policy, count: 1 });
  }
  flush() {
    const counters = [...this.counters.values()];
    this.counters.clear();
    this.sink({ event: "security_metrics", windowSeconds: 60, counters });
  }
}
let sink: Sink = () => {};
const metrics = new SecurityMetrics((event) => sink(event));
const timer = setInterval(() => metrics.flush(), 60_000);
timer.unref();
export const setSecurityMetricSink = (next: Sink) => { sink = next; };
export const recordSecurityEvent = (name: Event, policy?: string) => metrics.record(name, policy);
export const flushSecurityMetrics = () => metrics.flush();
export function recordSecurityFailure(name: Failure) {
  metrics.record(name);
  // Fatal startup must not lose its event while waiting for the minute timer.
  writeSync(2, `${JSON.stringify({ event: "security_failure", name })}\n`);
}
export function reportDatabaseFailure(error: unknown): boolean {
  // DNS/connect failures can also originate from OIDC/AI providers.
  const databaseQuery = error instanceof DrizzleQueryError;
  let value = error;
  for (let depth = 0; depth < 3 && value && typeof value === "object"; depth++) {
    const code = "code" in value ? value.code : undefined;
    if (typeof code === "string" && (/^(08[0-9A-Z]{3}|53[0-9A-Z]{3}|57[0-9A-Z]{3}|42P01|42703|28P01|3D000)$/.test(code)
      || (databaseQuery && /^(ECONNREFUSED|ENOTFOUND|ETIMEDOUT)$/.test(code)))) {
      recordSecurityFailure("database_failure");
      if (code === "42P01" || code === "42703") recordSecurityFailure("migration_readiness_failure");
      return true;
    }
    value = "cause" in value ? value.cause : undefined;
  }
  return false;
}
