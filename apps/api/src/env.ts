// Environment-based configuration: every variable is validated at boot
// (fail fast) using Zod. See .env.example for documentation.
import { z } from "zod";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

// Load .env from the package root (works under tsx dev, tsc build and containers)
for (const candidate of [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../../.env"),
]) {
  if (fs.existsSync(candidate) && dotenv.config({ path: candidate, override: false }).parsed) {
    break;
  }
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  DATABASE_URL: z
    .string()
    .url()
    .refine((v) => v.startsWith("postgresql://"), "DATABASE_URL must be a PostgreSQL connection string"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),
  JWT_EXPIRES_IN: z.string().default("60m"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // AI assistant – provider-agnostic OpenAI-compatible adapter.
  // Empty key ⇒ deterministic mock fallback (demo-safe).
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_API_VERSION: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const corsOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
