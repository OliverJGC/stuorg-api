import { jest } from "@jest/globals";
import request from "supertest";

import { createAppConfig } from "../../../mocks/createAppConfig.js";
import type { OrganizationService } from "../../../src/modules/organizations/organizationService.js";
import { API_MESSAGE } from "../../../src/utils/constants.js";
import { HttpError } from "../../../src/utils/httpError.js";

const organizationService = {
  createOrganization: jest.fn<OrganizationService["createOrganization"]>(),
  validateOrganizationName: jest.fn<OrganizationService["validateOrganizationName"]>(),
};

jest.unstable_mockModule("../../../src/infrastructure/createDependencies.js", () => ({
  organizationService,
}));

const { createApp } = await import("../../../src/app.js");

const input = {
  name: "Engineering Club",
  admin: {
    firstName: "Alex",
    lastName: "Rivera",
    email: "alex@miners.utep.edu",
    password: "example-password",
    role: "President",
  },
};

describe("organization routes", () => {
  beforeEach(() => {
    organizationService.createOrganization.mockReset();
    organizationService.validateOrganizationName.mockReset();
  });

  it("rejects invalid creation input without invoking the service", async () => {
    const app = createApp(createAppConfig);
    const response = await request(app).post("/internal/organizations").send({
      name: "  ",
      admin: { firstName: "", lastName: "Rivera", email: "alex@example.com", password: "short", role: "" },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: API_MESSAGE.INVALID_INPUT });
    expect(organizationService.createOrganization).not.toHaveBeenCalled();
  });

  it("returns a safe message when the service is unavailable", async () => {
    organizationService.validateOrganizationName.mockRejectedValue(new HttpError("Database unavailable", 503));
    const app = createApp(createAppConfig);
    const response = await request(app).post("/internal/organizations/name-availability").send({ name: "Engineering Club" });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ message: API_MESSAGE.SERVICE_UNAVAILABLE });
  });

  it("returns name availability for validated input", async () => {
    organizationService.validateOrganizationName.mockResolvedValue({
      name: "Engineering Club",
      available: true,
    });
    const app = createApp(createAppConfig);
    const response = await request(app)
      .post("/internal/organizations/name-availability")
      .send({ name: "  Engineering Club  " });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ name: "Engineering Club", available: true });
    expect(organizationService.validateOrganizationName).toHaveBeenCalledWith("Engineering Club");
  });

  it("rejects an invalid organization name without invoking the service", async () => {
    const app = createApp(createAppConfig);
    const response = await request(app)
      .post("/internal/organizations/name-availability")
      .send({ name: " " });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: API_MESSAGE.INVALID_INPUT });
    expect(organizationService.validateOrganizationName).not.toHaveBeenCalled();
  });

  it("preserves an Auth failure status without exposing its message", async () => {
    organizationService.createOrganization.mockRejectedValue(new HttpError("email is already registered in Supabase", 409));
    const app = createApp(createAppConfig);
    const response = await request(app).post("/internal/organizations").send(input);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: API_MESSAGE.CONFLICT });
  });

  it("does not expose internal details when organization creation fails", async () => {
    organizationService.createOrganization.mockRejectedValue(new Error("database unavailable"));
    const app = createApp(createAppConfig);
    const response = await request(app).post("/internal/organizations").send(input);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: API_MESSAGE.INTERNAL_SERVER_ERROR });
  });

  it("passes validated input to the shared service and returns its result", async () => {
    const result = {
      organization: { id: "organization-id", name: input.name },
      admin: {
        id: "auth-user-id",
        firstName: input.admin.firstName,
        lastName: input.admin.lastName,
        email: input.admin.email,
        role: input.admin.role,
      },
    };
    organizationService.createOrganization.mockResolvedValue(result);
    const app = createApp(createAppConfig);
    const response = await request(app).post("/internal/organizations").send(input);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(result);
    expect(organizationService.createOrganization).toHaveBeenCalledWith(input);
  });

  it("returns JSON for malformed request bodies", async () => {
    const app = createApp(createAppConfig);
    const response = await request(app)
      .post("/internal/organizations/name-availability")
      .set("Content-Type", "application/json")
      .send("{");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: API_MESSAGE.INVALID_JSON });
  });

  it("returns JSON when a request body exceeds the configured limit", async () => {
    const app = createApp(createAppConfig);
    const response = await request(app)
      .post("/internal/organizations")
      .send({ name: "a".repeat(102_401) });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ message: API_MESSAGE.PAYLOAD_TOO_LARGE });
  });

  it("returns JSON when request encoding is unsupported", async () => {
    const app = createApp(createAppConfig);
    const response = await request(app)
      .post("/internal/organizations/name-availability")
      .set("Content-Type", "application/json")
      .set("Content-Encoding", "gzip")
      .send('{"name":"Engineering Club"}');

    expect(response.status).toBe(415);
    expect(response.body).toEqual({ message: API_MESSAGE.UNSUPPORTED_ENCODING });
  });
});
