import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "./errorHandler";

/**
 * Middleware that requires the request to have a valid authenticated session.
 * Returns 401 if no user is present.
 * Use after authMiddleware (which is mounted globally in app.ts).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    next(new UnauthorizedError());
    return;
  }
  next();
}
