import { z } from "zod";

const DEFAULT_DEVELOPMENT_ORIGIN = "http://localhost:3000";

export type RuntimeConfig = {
  corsOrigins: string[];
  databaseUrl?: string;
  environment: "development" | "production" | "test";
  port: number;
};

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
  DATABASE_URL: databaseUrlSchema.optional(),
  CORS_ORIGINS: z.string()
    .transform((value) => value.split(",").map((origin) => origin.trim()))
    .pipe(z.array(originSchema).min(1))
    .optional(),
}).superRefine((value, context) => {
  if (value.NODE_ENV !== "development" && !value.CORS_ORIGINS) {
    context.addIssue({
      code: "custom",
      message: "Required outside development",
      path: ["CORS_ORIGINS"],
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
    ...(value.DATABASE_URL ? { databaseUrl: value.DATABASE_URL } : {}),
    environment: value.NODE_ENV,
    port: value.PORT,
  };
}
