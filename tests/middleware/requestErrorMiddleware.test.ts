import { jest } from "@jest/globals";
import type { Request, Response } from "express";
import { requestErrorMiddleware } from "../../src/middleware/requestErrorMiddleware.js";

it("passes unrelated errors to the next error handler", () => {
  const error = new Error("unexpected");
  const next = jest.fn();
  requestErrorMiddleware(error, {} as Request, {} as Response, next);
  expect(next).toHaveBeenCalledWith(error);
});
