import { getLoggingConfig, getRuntimeConfig } from "../../src/config/runtimeConfig.js";

const validEnvironment = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://localhost/stuorg",
  SUPABASE_SERVICE_ROLE_KEY: "key",
  SUPABASE_URL: "https://example.supabase.co",
  CORS_ORIGINS: "https://example.com, https://example.com",
};

describe("runtime configuration", () => {
  it("loads and deduplicates valid configuration", () => {
    expect(getRuntimeConfig(validEnvironment)).toMatchObject({
      corsOrigins: ["https://example.com"],
      port: 5001,
      logLevel: "info",
    });
  });

  it.each(["not a url", "ftp://example.com", "https://example.com/path", "https://*.example.com"])(
    "rejects invalid CORS origin %s",
    (origin) => {
      expect(() => getRuntimeConfig({ ...validEnvironment, CORS_ORIGINS: origin })).toThrow(
        "CORS_ORIGINS",
      );
    },
  );

  it.each(["not a url", "https://localhost/db", "postgresql://localhost/"])(
    "rejects invalid database URL %s",
    (url) => {
      expect(() => getRuntimeConfig({ ...validEnvironment, DATABASE_URL: url })).toThrow(
        "DATABASE_URL",
      );
    },
  );

  it("rejects invalid logging configuration", () => {
    expect(() => getLoggingConfig({ NODE_ENV: "invalid" })).toThrow(
      "Invalid logging configuration",
    );
  });

  it("rejects an empty Supabase URL when a service key is present", () => {
    expect(() => getRuntimeConfig({ ...validEnvironment, SUPABASE_URL: "" })).toThrow(
      "SUPABASE_URL",
    );
  });

  it.each([
    ["development", "debug"],
    ["test", "silent"],
    ["production", "info"],
  ])("uses the default %s log level", (environment, level) => {
    expect(getLoggingConfig({ NODE_ENV: environment }).logLevel).toBe(level);
  });

  it("accepts an explicit log level", () => {
    expect(getLoggingConfig({ NODE_ENV: "test", LOG_LEVEL: "warn" }).logLevel).toBe("warn");
  });
});
