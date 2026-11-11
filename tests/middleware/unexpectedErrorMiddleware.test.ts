import { jest } from "@jest/globals";
import express, { type Request, type Response } from "express";
import request from "supertest";

import { captureLogs } from "../../mocks/captureLogs.js";
import { unexpectedErrorMiddleware } from "../../src/middleware/unexpectedErrorMiddleware.js";
import { API_MESSAGE } from "../../src/utils/constants.js";

describe("unexpectedErrorMiddleware", () => {
  it("closes an already-started response without forwarding raw errors to Express", () => {
    const log = captureLogs();
    const destroy = jest.fn();
    const next = jest.fn();
    unexpectedErrorMiddleware(
      new Error("private-message"),
      {} as Request,
      { headersSent: true, destroy } as unknown as Response,
      next,
    );
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
    expect(JSON.stringify(log.calls)).not.toContain("private-message");
  });

  afterEach(() => jest.restoreAllMocks());
  it("logs unexpected failures once and returns a generic JSON response", async () => {
    const log = captureLogs();
    const app = express();
    app.get("/failure", () => {
      throw new Error("Internal failure");
    });
    app.use(unexpectedErrorMiddleware);
    const response = await request(app).get("/failure");
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: API_MESSAGE.INTERNAL_SERVER_ERROR });
    expect(log.calls).toEqual([[{ status: 500 }, "Unexpected request failure"]]);
  });
});
