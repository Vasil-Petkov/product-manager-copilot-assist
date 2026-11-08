import cors from "cors";
import type { RequestHandler } from "express";
import { recordSecurityEvent } from "../lib/security-events.ts";

export function securityCors(origins: ReadonlySet<string>): RequestHandler {
  const middleware = cors({
    credentials: true,
    origin: (origin, callback) => callback(null, origin !== undefined && origins.has(origin)),
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    maxAge: 600,
  });
  return (req, res, next) => {
    res.vary("Origin");
    const origin = req.headers.origin;
    if (origin !== undefined && !origins.has(origin)) {
      recordSecurityEvent("cors_rejected");
      res.status(403).json({ error: "Origin not allowed" });
      return;
    }
    middleware(req, res, next);
  };
}
