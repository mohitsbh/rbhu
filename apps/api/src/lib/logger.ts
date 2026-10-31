// Structured logging with request correlation.
import pino from "pino";
import { env, isProd } from "../env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "rbhu-api" },
  redact: {
    paths: ["req.headers.authorization", "password", "*.password", "passwordHash", "apiKey"],
    censor: "[redacted]",
  },
  transport: isProd
    ? undefined
    : { target: "pino/file", options: { destination: 1 } }, // stdout w/o pretty dep
});

export function childLogger(ctx: Record<string, unknown>) {
  return logger.child(ctx);
}
