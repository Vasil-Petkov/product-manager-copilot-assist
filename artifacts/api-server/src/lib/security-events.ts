type Event = "csrf_rejected" | "cors_rejected" | "rate_allowed" | "rate_limited" | "rate_store_unavailable" | "demo_capacity";
type Sink = (metric: { event: "security_metrics"; windowSeconds: number; counters: Array<{ name: Event; policy: string; count: number }> }) => void;
const policies = new Set(["all", "auth", "authRead", "demoCreate", "demoRead", "demoExit", "generation", "analysis", "chat"]);

/** Bounded labels only: never accept request data, IDs, tokens or raw paths. */
export class SecurityMetrics {
  private counters = new Map<string, { name: Event; policy: string; count: number }>();
  constructor(private sink: Sink) {}
  record(name: Event, policy = "all") {
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
