// Typed domain errors + global error middleware.
// Every handler throws these; one middleware renders them consistently.
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger.js";
import { isProd } from "../env.js";

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = "HTTP_ERROR",
    public details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const NotFound = (what = "Resource") => new HttpError(404, `${what} not found`, "NOT_FOUND");
export const BadRequest = (msg = "Bad request", details?: unknown) =>
  new HttpError(400, msg, "BAD_REQUEST", details);
export const Unauthorized = (msg = "Authentication required") =>
  new HttpError(401, msg, "UNAUTHORIZED");
export const Forbidden = (msg = "Access denied") => new HttpError(403, msg, "FORBIDDEN");
export const Conflict = (msg: string) => new HttpError(409, msg, "CONFLICT");

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Route not found", code: "NOT_FOUND", statusCode: 404 });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return void res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      statusCode: 422,
      details: err.flatten().fieldErrors,
    });
  }
  if (err instanceof HttpError) {
    return void res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      statusCode: err.statusCode,
      details: err.details ?? undefined,
    });
  }
  // Unknown errors: log fully, never leak internals to the client
  logger.error({ err }, "unhandled error");
  return void res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
    statusCode: 500,
    ...(isProd ? {} : { hint: err instanceof Error ? err.message : String(err) }),
  });
}
