import { Writable } from "node:stream";

import { getLoggingConfig, getRuntimeConfig } from "../../../src/config/runtimeConfig.js";
import { createLogger, getLogger, runWithLogger } from "../../../src/infrastructure/logging/logger.js";

function captureLogger() {
  const lines: string[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });
  const logger = createLogger({ environment: "production", logLevel: "debug" }, destination);

  return { logger, lines };
}

describe("logging configuration", () => {
  it.each([
    ["development", "debug"], ["production", "info"], ["test", "silent"],
  ])("defaults %s to %s", (environment, level) => {
    expect(getLoggingConfig({ NODE_ENV: environment })).toEqual({ environment, logLevel: level });
  });

  it("validates overrides and exposes the level through runtime config", () => {
    expect(getLoggingConfig({ NODE_ENV: "production", LOG_LEVEL: "warn" }).logLevel).toBe("warn");
    expect(() => getLoggingConfig({ LOG_LEVEL: "private-invalid-value" })).toThrow("Invalid logging configuration");
    expect(getRuntimeConfig({
      NODE_ENV: "test", LOG_LEVEL: "error", DATABASE_URL: "postgresql://test:test@localhost/db",
      SUPABASE_URL: "https://project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "private-key",
      CORS_ORIGINS: "http://localhost:3000",
    }).logLevel).toBe("error");
  });

  it("creates a pretty transport only in development", async () => {
    const dev = createLogger({ environment: "development", logLevel: "debug" });
    const prod = createLogger({ environment: "production", logLevel: "info" });
    expect(dev.level).toBe("debug");
    expect(prod.level).toBe("info");
    // Closing the worker transport prevents an open handle in Jest.
    const { symbols } = await import("pino");
    const transport = (dev as unknown as Record<symbol, { end(): void }>)[symbols.streamSym];
    transport?.end();
  });
});

describe("logger privacy and context", () => {
  it("removes credential fields and raw error objects from JSON", () => {
    const { logger, lines } = captureLogger();
    logger.error({
      password: "private-password", accessToken: "private-access-token",
      refresh_token: "private-refresh-token", databaseUrl: "private-db-url",
      nested: { token: "private-token" },
      req: { headers: { authorization: "private-auth" }, body: { password: "private-body" }, query: { token: "private-query" } },
      err: new Error("private-message"), error: new Error("private-other-message"),
    }, "Controlled failure");
    expect(lines.join("")).not.toContain("private-");
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({ msg: "Controlled failure", level: 50 });
  });

  it("isolates concurrent async contexts and falls back outside requests", async () => {
    const { logger, lines } = captureLogger();
    const outside = getLogger();
    await Promise.all(["first", "second"].map((reqId) => runWithLogger(logger.child({ reqId }), async () => {
      await new Promise((resolve) => setTimeout(resolve, reqId === "first" ? 5 : 0));
      getLogger().info({ operation: reqId }, "Context preserved");
    })));
    const events = lines.map((line) => JSON.parse(line) as { reqId: string; operation: string });
    expect(events).toHaveLength(2);
    for (const event of events) expect(event.reqId).toBe(event.operation);
    expect(getLogger()).toBe(outside);
  });
});
