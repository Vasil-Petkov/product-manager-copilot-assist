import { BlockList, isIP } from "node:net";

export type PolicyName = "auth" | "authRead" | "demoCreate" | "demoRead" | "demoExit" | "generation" | "analysis" | "chat";
export interface RatePolicy { windowMs: number; ipLimit: number; userLimit?: number }
export const DEFAULT_POLICIES: Record<PolicyName, RatePolicy> = {
  auth: { windowMs: 900_000, ipLimit: 30 },
  authRead: { windowMs: 60_000, ipLimit: 120 },
  demoCreate: { windowMs: 600_000, ipLimit: 12 },
  demoRead: { windowMs: 60_000, ipLimit: 120 },
  demoExit: { windowMs: 60_000, ipLimit: 60 },
  generation: { windowMs: 600_000, ipLimit: 20, userLimit: 6 },
  analysis: { windowMs: 600_000, ipLimit: 40, userLimit: 12 },
  chat: { windowMs: 600_000, ipLimit: 90, userLimit: 30 },
};

export function readSecurityConfig(env: NodeJS.ProcessEnv = process.env) {
  const production = env.NODE_ENV === "production";
  const origins = new Set<string>();
  const rawOrigins = env.CORS_ALLOWED_ORIGINS
    ?? (!production && env.REPLIT_DEV_DOMAIN ? `https://${env.REPLIT_DEV_DOMAIN}` : "");
  if (production && !rawOrigins.trim()) throw new Error("CORS_ALLOWED_ORIGINS is required in production");
  for (const raw of rawOrigins.split(",").filter(Boolean)) {
    const origin = raw.trim();
    let url: URL;
    try { url = new URL(origin); } catch { throw new Error("Invalid CORS_ALLOWED_ORIGINS"); }
    if (url.origin !== origin || !["http:", "https:"].includes(url.protocol)
      || (production && url.protocol !== "https:") || origin.includes("*")) {
      throw new Error("CORS_ALLOWED_ORIGINS must contain exact canonical origins without paths");
    }
    origins.add(origin);
  }
  if (production && origins.size === 0) throw new Error("CORS_ALLOWED_ORIGINS is required in production");

  // No guessed hop count, private network range, or forwarded-header trust.
  const trusted = new BlockList();
  let proxyCount = 0;
  const cidrs = env.TRUSTED_PROXY_CIDRS ?? "";
  if (production && !cidrs.trim()) throw new Error("Verified TRUSTED_PROXY_CIDRS is required in production");
  for (const raw of cidrs.split(",").filter(Boolean)) {
    const parts = raw.trim().split("/");
    const family = isIP(parts[0]);
    const bits = family === 4 ? 32 : 128;
    const prefix = parts.length === 1 ? bits : Number(parts[1]);
    if (!family || parts.length > 2 || !Number.isInteger(prefix) || prefix < 1 || prefix > bits) {
      throw new Error("Invalid TRUSTED_PROXY_CIDRS; unrestricted proxy trust is forbidden");
    }
    trusted.addSubnet(parts[0], prefix, family === 4 ? "ipv4" : "ipv6");
    proxyCount++;
  }
  if (production && proxyCount === 0) throw new Error("Verified TRUSTED_PROXY_CIDRS is required in production");
  const isTrustedProxy = (ip: string) => {
    const family = isIP(ip);
    return family !== 0 && trusted.check(ip, family === 4 ? "ipv4" : "ipv6");
  };
  const policies = structuredClone(DEFAULT_POLICIES);
  if (env.RATE_LIMITS_JSON) {
    const overrides: unknown = JSON.parse(env.RATE_LIMITS_JSON);
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) throw new Error("Invalid RATE_LIMITS_JSON");
    for (const [name, fields] of Object.entries(overrides)) {
      if (!Object.hasOwn(policies, name) || !fields || typeof fields !== "object" || Array.isArray(fields)) throw new Error("Invalid rate policy");
      const policy = policies[name as PolicyName];
      for (const [field, value] of Object.entries(fields)) {
        if (!["windowMs", "ipLimit", ...(policy.userLimit ? ["userLimit"] : [])].includes(field)
          || typeof value !== "number" || !Number.isSafeInteger(value) || value < 1
          || value > (field === "windowMs" ? 86_400_000 : 100_000)) throw new Error("Invalid rate policy limit");
        Object.assign(policy, { [field]: value });
      }
    }
  }
  return { origins, isTrustedProxy, policies };
}
