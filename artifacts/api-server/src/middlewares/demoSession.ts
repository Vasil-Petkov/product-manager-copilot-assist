import type { NextFunction, Request, Response } from "express";
import {
  DEMO_SESSION_COOKIE,
  getDemoSession,
} from "../lib/demoSession.ts";

declare global {
  namespace Express {
    interface Request {
      isDemoSession(): boolean;
      demoTenantId?: string;
    }
  }
}

export function demoSessionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const sessionId = req.cookies?.[DEMO_SESSION_COOKIE] as string | undefined;
  const session = getDemoSession(sessionId);

  req.demoTenantId = session?.tenantId;
  req.isDemoSession = () => Boolean(req.demoTenantId);

  if (sessionId && !session) {
    res.clearCookie(DEMO_SESSION_COOKIE, { path: "/" });
  }

  next();
}