import crypto from "crypto";

export const DEMO_SESSION_COOKIE = "pm_demo_session";
export const DEMO_TENANT_ID = "public-demo";
export const DEMO_SESSION_TTL = 60 * 60 * 1000;

export interface DemoSessionData {
  tenantType: "public-demo";
  tenantId: typeof DEMO_TENANT_ID;
  expiresAt: number;
}

export class DemoCapacityError extends Error {}

export class DemoSessionStore {
  private sessions = new Map<string, DemoSessionData>();
  private timer: ReturnType<typeof setInterval>;
  constructor(
    readonly capacity = 1000,
    private now: () => number = Date.now,
    cleanupIntervalMs = 60_000,
  ) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 100_000) throw new Error("Invalid DEMO_SESSION_CAP");
    if (!Number.isSafeInteger(cleanupIntervalMs) || cleanupIntervalMs < 1) throw new Error("Invalid demo cleanup interval");
    this.timer = setInterval(() => this.prune(), cleanupIntervalMs);
    this.timer.unref();
  }
  prune(): void {
    const now = this.now();
    for (const [id, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(id);
    }
  }
  get size() { return this.sessions.size; }
  dispose(): void { clearInterval(this.timer); this.sessions.clear(); }
  create(ttl = DEMO_SESSION_TTL): string {
    if (!Number.isFinite(ttl) || ttl < 0 || ttl > DEMO_SESSION_TTL) throw new Error("Invalid demo TTL");
    this.prune();
    if (this.sessions.size >= this.capacity) throw new DemoCapacityError("Demo capacity reached");
    const id = crypto.randomBytes(32).toString("hex");
    this.sessions.set(id, { tenantType: "public-demo", tenantId: DEMO_TENANT_ID, expiresAt: this.now() + ttl });
    return id;
  }
  get(id: string | undefined): DemoSessionData | null {
    if (!id) return null;
    const session = this.sessions.get(id);
    if (!session || session.expiresAt <= this.now()) { this.sessions.delete(id); return null; }
    return session;
  }
  delete(id: string | undefined): void { if (id) this.sessions.delete(id); }
}

const demoSessions = new DemoSessionStore(Number(process.env.DEMO_SESSION_CAP ?? 1000));

export function createDemoSession(ttl = DEMO_SESSION_TTL): string {
  return demoSessions.create(ttl);
}

export function getDemoSession(
  sessionId: string | undefined,
): DemoSessionData | null {
  return demoSessions.get(sessionId);
}

export function deleteDemoSession(sessionId: string | undefined): void {
  demoSessions.delete(sessionId);
}