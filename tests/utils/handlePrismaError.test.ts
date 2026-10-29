import { jest } from "@jest/globals";
import { Prisma } from "@prisma/client";

import { handlePrismaError } from "../../src/utils/handlePrismaError.js";
import { HttpError } from "../../src/utils/httpError.js";
import { API_MESSAGE } from "../../src/utils/constants.js";

describe("handlePrismaError", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ["P2000", 400], ["P2001", 404], ["P2002", 409], ["P2003", 409],
    ["P2011", 400], ["P2014", 409], ["P2015", 404], ["P2024", 503],
    ["P2025", 404], ["P2028", 500], ["P2034", 409], ["P2037", 503],
  ] as const)("maps %s to a safe HTTP error", (code, statusCode) => {
    const error = new Prisma.PrismaClientKnownRequestError("private database details", {
      code, clientVersion: "test",
    });
    const mapped = handlePrismaError(error);
    expect(mapped).toBeInstanceOf(HttpError);
    expect(mapped).toMatchObject({ statusCode, message: API_MESSAGE[code] });
    expect(console.error).toHaveBeenCalled();
  });

  it("preserves an existing HttpError status while hiding its private message", () => {
    const error = new HttpError("internal provider error", 422);
    expect(handlePrismaError(error)).toMatchObject({ statusCode: 422, message: API_MESSAGE.UNPROCESSABLE_ENTITY });
  });

  it("uses a generic response for unexpected errors", () => {
    expect(handlePrismaError(new Error("private details")))
      .toMatchObject({ statusCode: 500, message: API_MESSAGE.INTERNAL_SERVER_ERROR });
  });
});
