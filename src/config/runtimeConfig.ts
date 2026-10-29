import { z } from "zod";
import type { RuntimeConfig } from "../types/config.js";

const DEFAULT_DEVELOPMENT_ORIGIN = "http://localhost:3000";

const originSchema = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin === value &&
      !value.includes("*")
    );
  } catch {
    return false;
  }
}, "Must be an exact HTTP or HTTPS origin");

const databaseUrlSchema = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "postgres:" || url.protocol === "postgresql:") &&
      Boolean(url.hostname) &&
      url.pathname.length > 1
    );
  } catch {
    return false;
  }
}, "Must be a PostgreSQL connection URL");

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().regex(/^\d+$/).default("5001").transform(Number)
    .pipe(z.number().int().min(1).max(65_535)),
  DATABASE_URL: databaseUrlSchema,
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1),
  SUPABASE_URL: z.string().url(),
  CORS_ORIGINS: z.string()
    .transform((value) => value.split(",").map((origin) => origin.trim()))
    .pipe(z.array(originSchema).min(1))
}).superRefine((value, context) => {
  if (value.NODE_ENV !== "development" && !value.CORS_ORIGINS) {
    context.addIssue({
      code: "custom",
      message: "Required outside development",
      path: ["CORS_ORIGINS"],
    });
  }

  if (Boolean(value.SUPABASE_URL) !== Boolean(value.SUPABASE_SERVICE_ROLE_KEY)) {
    context.addIssue({
      code: "custom",
      message: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured together",
      path: ["SUPABASE_URL"],
    });
  }
});

export function getRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? "configuration")))];
    throw new Error(`Invalid configuration: ${names.join(", ")}`);
  }

  const value = result.data;
  return {
    corsOrigins: [...new Set(value.CORS_ORIGINS ?? [DEFAULT_DEVELOPMENT_ORIGIN])],
    databaseUrl: value.DATABASE_URL,
    environment: value.NODE_ENV,
    port: value.PORT,
    supabaseServiceRoleKey: value.SUPABASE_SERVICE_ROLE_KEY,
    supabaseUrl: value.SUPABASE_URL
  };
}
