import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodType } from "zod";

type RequestPart = "body" | "query" | "params";

/**
 * Returns Express middleware that validates request[part] against schema.
 * On failure calls next() with a structured ZodError (caught by errorHandler).
 */
export function validate<T>(
  schema: ZodType<T>,
  part: RequestPart = "body",
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[part]);
      // Replace the raw data with the parsed (coerced/stripped) version
      (req as Record<string, unknown>)[part] = parsed;
      next();
    } catch (err) {
      next(err);
    }
  };
}
