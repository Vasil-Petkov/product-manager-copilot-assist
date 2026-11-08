import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import type { RequestHandler } from "express";
import type { PolicyName, RatePolicy } from "../lib/security-config.ts";
import type { Bucket, RateLimitStore } from "../lib/rate-limit-store.ts";
import { recordSecurityEvent } from "../lib/security-events.ts";

export function policyFor(method: string, path: string): PolicyName | undefined {
  if (method === "HEAD") method = "GET";
  // Express routing is case-insensitive and tolerates a terminal slash.
  path = path.toLowerCase().replace(/\/+$/, "");
  if (method === "GET" && ["/auth/user", "/auth/csrf"].includes(path)) return "authRead";
  if ((method === "GET" && ["/login", "/callback", "/logout"].includes(path))
    || (method === "POST" && ["/logout", "/mobile-auth/token-exchange", "/mobile-auth/logout"].includes(path))) return "auth";
  if (path === "/demo/session" && method === "POST") return "demoCreate";
  if (path === "/demo/session" && method === "GET") return "demoRead";
  if (path === "/demo/session/exit" && method === "POST") return "demoExit";
  if (method === "POST" && /^\/openai\/conversations\/[^/]+\/messages$/.test(path)) return "chat";
  if (method === "POST" && (/^\/documents\/[^/]+\/regenerate$/.test(path)
    || ["/documents/generate", "/insights/generate", "/roadmap/proposal"].includes(path))) return "generation";
  if (method === "POST" && path === "/dashboard/daily-summary") return "analysis";
  if (method === "POST" && (
    /^\/(competitors|meetings|opportunities)\/[^/]+\/analyze$/.test(path)
    || /^\/product-ideas\/[^/]+\/similarity$/.test(path)
    || /^\/prioritization\/analyze\/[^/]+$/.test(path)
    || /^\/validation\/experiments\/[^/]+\/analyze-result$/.test(path)
    || ["/product-ideas/similarity/compare", "/prioritization/ai-recommend", "/prioritization/compare", "/validation/hypotheses/improve", "/validation/experiments/assist"].includes(path)
  )) return "analysis";
  return undefined;
}

export function securityRateLimit(
  store: RateLimitStore,
  policies: Record<PolicyName, RatePolicy>,
  phase: "public" | "authenticated",
  keySecret: string,
  unavailable: () => void = () => {},
): RequestHandler {
  if (keySecret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters for counter protection");
  return async (req, res, next) => {
    const name = policyFor(req.method, req.path);
    if (!name) return next();
    const policy = policies[name];
    const privatePolicy = policy.userLimit !== undefined;
    if (privatePolicy !== (phase === "authenticated")) return next();
    // Preserve private deny-by-default. Demo never writes AI rate counters.
    if (privatePolicy && (req.isDemoSession() || !req.user || !req.isAuthenticated())) return next();
    const ip = req.ip;
    if (!ip || !isIP(ip)) {
      unavailable();
      res.setHeader("Retry-After", "30");
      res.status(503).json({ error: "Request protection unavailable" });
      return;
    }
    const hash = (kind: string, value: string) => createHmac("sha256", keySecret).update(`rate-limit:v1:${name}:${kind}:${value}`).digest("hex");
    const buckets: Bucket[] = [{ key: hash("ip", ip), limit: policy.ipLimit, windowMs: policy.windowMs }];
    if (privatePolicy) buckets.push({ key: hash("user", req.user!.id), limit: policy.userLimit!, windowMs: policy.windowMs });
    try {
      const result = await store.consume(buckets);
      if (!result.allowed) {
        recordSecurityEvent("rate_limited", name);
        res.setHeader("Retry-After", String(result.retryAfter));
        res.setHeader("Cache-Control", "no-store");
        res.status(429).json({ error: "Too many requests. Please retry later." });
        return;
      }
      recordSecurityEvent("rate_allowed", name);
      next();
    } catch {
      // Never fail open or log query parameters/DB credentials on store failure.
      unavailable();
      res.setHeader("Retry-After", "30");
      res.status(503).json({ error: "Request protection unavailable" });
    }
  };
}
