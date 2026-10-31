// Shared Prisma client instance (singleton across hot reloads).
import { PrismaClient } from "@prisma/client";
import { env } from "../env.js";
import { logger } from "./logger.js";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

global.__prisma = prisma;

prisma.$on?.("error" as never, (e: unknown) => logger.error({ err: e }, "prisma error"));
