import crypto from "crypto";

export const DEMO_SESSION_COOKIE = "pm_demo_session";
export const DEMO_TENANT_ID = "public-demo";
export const DEMO_SESSION_TTL = 60 * 60 * 1000;

export interface DemoSessionData {
  tenantType: "public-demo";
  tenantId: typeof DEMO_TENANT_ID;
  expiresAt: number;
}

const demoSessions = new Map<string, DemoSessionData>();

function pruneExpiredSessions(now = Date.now()): void {
  for (const [sessionId, session] of demoSessions) {
    if (session.expiresAt <= now) {
      demoSessions.delete(sessionId);
    }
  }
}

export function createDemoSession(ttl = DEMO_SESSION_TTL): string {
  pruneExpiredSessions();

  const sessionId = crypto.randomBytes(32).toString("hex");
  demoSessions.set(sessionId, {
    tenantType: "public-demo",
    tenantId: DEMO_TENANT_ID,
    expiresAt: Date.now() + ttl,
  });
  return sessionId;
}

export function getDemoSession(
  sessionId: string | undefined,
): DemoSessionData | null {
  if (!sessionId) return null;

  const session = demoSessions.get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    demoSessions.delete(sessionId);
    return null;
  }

  return session;
}

export function deleteDemoSession(sessionId: string | undefined): void {
  if (sessionId) {
    demoSessions.delete(sessionId);
  }
}