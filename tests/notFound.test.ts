import request from "supertest";

import { createAppConfig } from "../mocks/createAppConfig.js";
import { createApp } from "../src/createApp.js";
import { API_MESSAGE } from "../src/utils/constants.js";

const app = createApp(createAppConfig);

describe("GET /missing-route", () => {
  it("returns HTTP 404 without starting a server", async () => {
    const response = await request(app).get("/missing-route");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: API_MESSAGE.NOT_FOUND });
  });
});
