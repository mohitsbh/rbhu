// Reusable Zod body validation middleware.
import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

export const validate = (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    // Defer rendering to the global error middleware for consistent 422
    return next(result.error);
  }
  req.body = result.data;
  return next();
};
