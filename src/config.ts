import { resolve } from "node:path";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default("127.0.0.1"),
  DATABASE_PATH: z.string().default("./data/jp-qac.sqlite"),
  NTA_APPLICATION_ID: z.string().trim().optional(),
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100)
});

export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env) {
  const value = schema.parse(source);
  return {
    ...value,
    databasePath: resolve(value.DATABASE_PATH),
    allowedOrigins: value.ALLOWED_ORIGINS.split(",").map((item) => item.trim()).filter(Boolean)
  };
}
