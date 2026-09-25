import { z } from "zod";

const defaultJwtSecret = "local-development-secret-change-me";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://postgres:postgres@localhost:5432/dhaka_tesla_pool"),
  JWT_SECRET: z.string().min(16).default(defaultJwtSecret),
  JWT_EXPIRES_IN: z.string().min(1).default("1d"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
});

const parsedEnv = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  API_PORT: process.env.API_PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  FRONTEND_URL: process.env.FRONTEND_URL,
});

if (
  parsedEnv.NODE_ENV === "production" &&
  parsedEnv.JWT_SECRET === defaultJwtSecret
) {
  throw new Error("JWT_SECRET must be configured in production.");
}

export const env = parsedEnv;
