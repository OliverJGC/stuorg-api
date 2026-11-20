import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import { createAuthRouter } from "../../../src/modules/auth/authRoutes.js";
import { HttpError } from "../../../src/types/httpError.js";
import type { AuthService } from "../../../src/modules/auth/authService.js";

const service = {
  signIn: jest.fn<AuthService["signIn"]>(),
  restore: jest.fn<AuthService["restore"]>(),
  signOut: jest.fn<AuthService["signOut"]>(),
};
const app = express();
app.use(express.json());
app.use(
  "/auth",
  createAuthRouter(service, { environment: "test", corsOrigins: ["http://localhost:3000"] }),
);
const origin = "http://localhost:3000";
const session = { accessToken: "access", refreshToken: "refresh", expiresIn: 3600 };

describe("auth routes", () => {
  beforeEach(() => jest.resetAllMocks());

  it("signs in with HTTP-only cookies and does not return tokens", async () => {
    service.signIn.mockResolvedValue(session);
    const response = await request(app)
      .post("/auth/sign-in")
      .set("Origin", origin)
      .send({ email: "a@utep.edu", password: "secret" });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(response.headers["set-cookie"].join(" ")).toContain("HttpOnly");
    expect(JSON.stringify(response.body)).not.toContain("refresh");
  });

  it("returns a generic response for invalid credentials", async () => {
    service.signIn.mockRejectedValue(new HttpError("private provider detail", 401));
    const response = await request(app)
      .post("/auth/sign-in")
      .set("Origin", origin)
      .send({ email: "a@utep.edu", password: "wrong" });
    expect(response.status).toBe(401);
    expect(JSON.stringify(response.body)).not.toContain("private provider detail");
  });

  it("returns an unavailable response without clearing sessions on provider failure", async () => {
    service.restore.mockRejectedValue(new HttpError("private provider detail", 503));
    const response = await request(app)
      .get("/auth/session")
      .set("Origin", origin)
      .set("Cookie", ["stuorg_refresh=refresh"]);
    expect(response.status).toBe(503);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects untrusted origins before sign in", async () => {
    const response = await request(app)
      .post("/auth/sign-in")
      .set("Origin", "https://evil.example")
      .send({ email: "a@utep.edu", password: "secret" });
    expect(response.status).toBe(403);
    expect(service.signIn).not.toHaveBeenCalled();
  });

  it("requires a session to restore memberships", async () => {
    const response = await request(app).get("/auth/session").set("Origin", origin);
    expect(response.status).toBe(401);
  });

  it("returns the profile and memberships and updates refreshed cookies", async () => {
    const user = { id: "user-one", firstName: "Alex", lastName: "Rivera" };
    const memberships = [{ id: "one", name: "Club", role: "Member", isAdmin: false }];
    service.restore.mockResolvedValue({
      user,
      memberships,
      refreshedSession: session,
    });
    const response = await request(app)
      .get("/auth/session")
      .set("Origin", origin)
      .set("Cookie", ["stuorg_access=old", "stuorg_refresh=oldrefresh"]);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user, memberships });
    expect(response.headers["set-cookie"].join(" ")).toContain("stuorg_refresh=refresh");
  });

  it("returns the session data without setting cookies when no tokens were refreshed", async () => {
    const user = { id: "user-one", firstName: "Alex", lastName: "Rivera" };
    service.restore.mockResolvedValue({ user, memberships: [], refreshedSession: undefined });

    const response = await request(app)
      .get("/auth/session")
      .set("Origin", origin)
      .set("Cookie", ["stuorg_access=access"]);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user, memberships: [] });
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("returns a generic error when profile lookup throws", async () => {
    service.restore.mockRejectedValue(new Error("Record not found"));
    const response = await request(app)
      .get("/auth/session")
      .set("Origin", origin)
      .set("Cookie", ["stuorg_access=access"]);
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "An unexpected error occurred." });
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("clears cookies on sign out", async () => {
    service.signOut.mockResolvedValue(undefined);
    const response = await request(app)
      .post("/auth/sign-out")
      .set("Origin", origin)
      .set("Cookie", ["stuorg_access=access", "stuorg_refresh=refresh"]);
    expect(response.status).toBe(200);
    expect(response.headers["set-cookie"].join(" ")).toContain("Expires=Thu, 01 Jan 1970");
  });
});
