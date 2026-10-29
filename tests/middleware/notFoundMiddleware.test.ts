import { jest } from "@jest/globals";
import request from "supertest";

import { createAppConfig } from "../../mocks/createAppConfig.js";
import { API_MESSAGE } from "../../src/utils/constants.js";

jest.unstable_mockModule("../../src/infrastructure/createDependencies.js", () => ({
  organizationService: {
    createOrganization: jest.fn(),
    validateOrganizationName: jest.fn(),
  },
}));

const { createApp } = await import("../../src/app.js");
const app = createApp(createAppConfig);

describe("GET /missing-route", () => {
  it("returns HTTP 404 without starting a server", async () => {
    const response = await request(app).get("/missing-route");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: API_MESSAGE.NOT_FOUND });
  });
});
