import { jest } from "@jest/globals";
import { Writable } from "node:stream";
import { Prisma } from "@prisma/client";
import request from "supertest";
import express from "express";

import { createAppConfig } from "../../../mocks/createAppConfig.js";
import { createOrganizationDependencies } from "../../../mocks/organizationDependencies.js";
import { createSupabaseAuthClient } from "../../../src/infrastructure/auth/supabaseAuthClient.js";
import { createLogger } from "../../../src/infrastructure/logging/logger.js";
import { createHttpLoggingMiddleware } from "../../../src/middleware/httpLoggingMiddleware.js";

const dependencies = createOrganizationDependencies();
const auth = createSupabaseAuthClient("https://project.supabase.co", "private-key");
jest.unstable_mockModule("../../../src/infrastructure/createDependencies.js", () => ({
  organizationService: dependencies.organizationService,
}));
const { createApp } = await import("../../../src/app.js");

type LogEvent = { reqId: string; msg: string; level: number; method?: string; route?: string; status?: number; duration_ms?: number; dependency?: string };

function captureApp() {
  const lines: string[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });
  const logger = createLogger({ environment: "production", logLevel: "debug" }, destination);

  return { app: createApp(createAppConfig, logger), lines, events: () => lines.map((line) => JSON.parse(line) as LogEvent) };
}

const input = {
  name: "Club", admin: { firstName: "Alex", lastName: "Rivera", email: "private-email@utep.edu", password: "private-password", role: "President" },
};

describe("HTTP logging", () => {
  beforeEach(() => {
    dependencies.findFirst.mockReset();
    dependencies.transaction.mockReset();
    dependencies.auth.createUser.mockImplementation(auth.createUser);
    dependencies.auth.deleteUser.mockImplementation(auth.deleteUser);
  });
  afterEach(() => jest.restoreAllMocks());

  it("logs a route without a configured prefix", async () => {
    const lines: string[] = [];
    const destination = new Writable({ write(chunk, _encoding, callback) { lines.push(String(chunk)); callback(); } });
    const app = express();
    app.use(...createHttpLoggingMiddleware(createLogger({ environment: "production", logLevel: "info" }, destination)));
    app.get("/health", (_request, response) => response.sendStatus(200));
    await request(app).get("/health");
    expect(JSON.parse(lines[0]!)).toMatchObject({ route: "/health", status: 200 });
  });

  it("does not log successful CORS preflights", async () => {
    const { app, events } = captureApp();
    const response = await request(app).options("/internal/organizations")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(response.headers["x-request-id"]).toBeDefined();
    expect(events()).toHaveLength(0);
  });

  it("uses one UUID across service, dependency, cleanup, and HTTP logs", async () => {
    const { app, events, lines } = captureApp();
    dependencies.findFirst.mockResolvedValue(null);
    dependencies.transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("private-db-message", { code: "P2002", clientVersion: "test" }));
    jest.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "private-user" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "unexpected_failure", message: "private-provider-message" }), { status: 503 }));

    const response = await request(app).post("/internal/organizations?token=private-query")
      .set("X-Request-ID", "private-incoming-id").set("Authorization", "Bearer private-auth")
      .set("Cookie", "refresh=private-cookie").send(input);
    expect(response.status).toBe(409);
    const reqId: unknown = response.headers["x-request-id"];
    expect(reqId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(events().every((event) => event.reqId === reqId)).toBe(true);
    expect(events().filter((event) => event.dependency === "prisma")).toHaveLength(1);
    expect(events().filter((event) => event.dependency === "supabase")).toHaveLength(1);
    const summaries = events().filter((event) => event.duration_ms !== undefined);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ method: "POST", route: "/internal/organizations/", status: 409, level: 40 });
    expect(lines.join("")).not.toMatch(/private-|headers|stack|cause|remoteAddress|userAgent/);
  });

  it("summarizes malformed JSON and unknown routes without logging raw URLs or payloads", async () => {
    const { app, events, lines } = captureApp();
    const malformed = await request(app).post("/internal/organizations?password=private-query")
      .set("Content-Type", "application/json").send('{"password":"private-body"');
    const missing = await request(app).get("/private-path?token=private-token");
    expect(malformed.status).toBe(400);
    expect(missing.status).toBe(404);
    expect(events()).toHaveLength(2);
    expect(events()).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 400, route: "<unmatched>", level: 40 }),
      expect.objectContaining({ status: 404, route: "<unmatched>", level: 40 }),
    ]));
    expect(lines.join("")).not.toContain("private-");
  });

  it("uses error for 5xx and omits automatic raw error details", async () => {
    const { app, events, lines } = captureApp();
    dependencies.findFirst.mockRejectedValue(new Error("private-error-message"));
    const response = await request(app).post("/internal/organizations/name-availability").send({ name: "Club" });
    expect(response.status).toBe(500);
    const summaries = events().filter((event) => event.duration_ms !== undefined);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ level: 50, status: 500, msg: "Request failed" });
    expect(lines.join("")).not.toMatch(/private-|stack|"err"/);
  });

  it("keeps simultaneous requests isolated and logs successful outcomes at info", async () => {
    const { app, events } = captureApp();
    dependencies.findFirst.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { id: "existing-organization" };
    });
    const responses = await Promise.all([
      request(app).post("/internal/organizations").send(input),
      request(app).post("/internal/organizations/name-availability").send({ name: "Club" }),
    ]);
    const firstId: unknown = responses[0]?.headers["x-request-id"];
    const secondId: unknown = responses[1]?.headers["x-request-id"];
    expect(firstId).not.toBe(secondId);
    expect(events().filter((event) => event.reqId === firstId && event.duration_ms !== undefined)).toHaveLength(1);
    expect(events().filter((event) => event.reqId === secondId && event.duration_ms !== undefined)).toEqual([
      expect.objectContaining({ level: 30, status: 200, route: "/internal/organizations/name-availability" }),
    ]);
    expect(events().every((event) => event.reqId === firstId || event.reqId === secondId)).toBe(true);
  });

  it("uses a fixed fallback for unknown provider codes and omits provider error text", async () => {
    const { app, events, lines } = captureApp();
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ code: "private-code", message: "private-message" }), { status: 429 }));
    dependencies.findFirst.mockResolvedValue(null);
    const response = await request(app).post("/internal/organizations").send(input);
    expect(response.status).toBe(429);
    expect(events()).toContainEqual(expect.objectContaining({ dependency: "supabase", errorCode: "unknown", level: 40 }));
    expect(lines.join("")).not.toContain("private-");
  });
});
