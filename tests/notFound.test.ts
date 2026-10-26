import request from "supertest";

import { createApp } from "../src/createApp.js";
import { API_MESSAGE } from "../src/utils/constants.js";

const app = createApp({
  corsOrigins: ["http://localhost:3000"],
  environment: "test",
  port: 5001,
});

describe("GET /missing-route", () => {
  it("returns HTTP 404 without starting a server", async () => {
    const response = await request(app).get("/missing-route");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: API_MESSAGE.NOT_FOUND });
  });
});
