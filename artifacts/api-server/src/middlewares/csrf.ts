import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";
import { recordSecurityEvent } from "../lib/security-events.ts";

const NONCE_COOKIE = "pm_csrf";
const nonceCookie = () => process.env.NODE_ENV === "production" ? "__Host-pm_csrf" : NONCE_COOKIE;
const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
function signature(secret: string, sid: string, nonce: string) {
  return createHmac("sha256", secret).update(JSON.stringify(["csrf:v1", sid, nonce])).digest("hex");
}
export function csrfProtection(secret: string, allowedOrigins: ReadonlySet<string> = new Set()) {
  if (secret.length < 32) throw new Error("SESSION_SECRET must have at least 32 characters");
  const issue = (req: Request, res: Response) => {
    const old: unknown = req.cookies?.[nonceCookie()];
    res.setHeader("Cache-Control", "no-store");
    if (typeof old === "string" && /^[a-f0-9]{64}$/.test(old)) {
      // Reuse only as input to a fresh session-bound MAC, never reflect a
      // client-selected cookie value through Set-Cookie.
      return `${old}.${signature(secret, String(req.cookies?.sid ?? ""), old)}`;
    }
    const nonce = randomBytes(32).toString("hex");
    res.cookie(nonceCookie(), nonce, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
    });
    return `${nonce}.${signature(secret, String(req.cookies?.sid ?? ""), nonce)}`;
  };
  const guard: RequestHandler = (req, res, next) => {
    if (SAFE.has(req.method)) return next();
    // Native/mobile Bearer and PKCE requests have no ambient browser credentials.
    // Merely adding Authorization must NOT bypass protection of a sid cookie.
    const origin = req.get("Origin");
    const referer = req.get("Referer");
    const browser = Boolean(req.cookies?.sid || req.cookies?.pm_demo_session || origin !== undefined || referer !== undefined || req.get("Sec-Fetch-Site")
      || req.path.toLowerCase().replace(/\/+$/, "") === "/logout");
    if (!browser) return next();
    let sourceAllowed = req.get("Sec-Fetch-Site") !== "cross-site";
    if (origin !== undefined) sourceAllowed &&= allowedOrigins.has(origin);
    else if (referer !== undefined) {
      try {
        const source = new URL(referer);
        sourceAllowed &&= !source.username && !source.password && allowedOrigins.has(source.origin);
      } catch { sourceAllowed = false; }
    }
    // Missing Origin/Referer is NOT a token exemption. Privacy-preserving
    // same-origin browsers can still prove possession of session-bound CSRF.
    const token: unknown = req.get("X-CSRF-Token") ?? req.body?._csrf;
    const nonce: unknown = req.cookies?.[nonceCookie()];
    if (sourceAllowed && typeof nonce === "string" && /^[a-f0-9]{64}$/.test(nonce)
      && typeof token === "string" && /^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token)) {
      const expected = `${nonce}.${signature(secret, String(req.cookies?.sid ?? ""), nonce)}`;
      if (timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return next();
    }
    recordSecurityEvent("csrf_rejected");
    res.setHeader("Cache-Control", "no-store");
    res.status(403).json({ error: "Request verification failed. Refresh and retry." });
  };
  return { guard, issue };
}
