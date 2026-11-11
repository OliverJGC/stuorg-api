import { jest } from "@jest/globals";
import { Prisma } from "@prisma/client";

import { handleAndLogPrismaError } from "../../src/utils/handleAndLogPrismaError.js";
import { captureLogs } from "../../mocks/captureLogs.js";
import { HttpError } from "../../src/types/httpError.js";

describe("handleAndLogPrismaError", () => {
  let log: ReturnType<typeof captureLogs>;

  beforeEach(() => {
    log = captureLogs();
  });
  afterEach(() => jest.restoreAllMocks());
  it.each([
    ["P2000", 400],
    ["P2001", 404],
    ["P2002", 409],
    ["P2003", 409],
    ["P2011", 400],
    ["P2014", 409],
    ["P2015", 404],
    ["P2024", 503],
    ["P2025", 404],
    ["P2028", 500],
    ["P2034", 409],
    ["P2037", 503],
  ] as const)("maps %s to a safe HTTP error", (code, statusCode) => {
    const error = new Prisma.PrismaClientKnownRequestError("private database details", {
      code,
      clientVersion: "test",
    });
    const mapped = handleAndLogPrismaError(error);
    expect(mapped).toBeInstanceOf(HttpError);
    expect(mapped).toMatchObject({ statusCode, status: statusCode });
    expect(mapped.message).not.toBe("private database details");
    expect(mapped).not.toHaveProperty("cause");
    expect(log.calls).toEqual([
      [
        expect.objectContaining({ dependency: "prisma", code, status: statusCode }),
        "Database operation failed",
      ],
    ]);
    expect(JSON.stringify(log.calls)).not.toContain("private database details");
  });
  it("passes an existing HttpError through without logging it again", () => {
    const error = new HttpError("internal provider error", 422);
    expect(handleAndLogPrismaError(error)).toBe(error);
    expect(log.calls).toHaveLength(0);
  });
  it("keeps database meaning internally", () => {
    const error = new Prisma.PrismaClientKnownRequestError("private database details", {
      code: "P2002",
      clientVersion: "test",
    });
    expect(handleAndLogPrismaError(error)).toMatchObject({
      statusCode: 409,
      message: "Unique constraint violation",
    });
  });
  it("uses a generic response for unexpected errors", () => {
    expect(handleAndLogPrismaError(new Error("private details"))).toMatchObject({
      statusCode: 500,
      message: "Unexpected database error",
    });
  });
  it("uses a generic response and log code for an unknown Prisma code", () => {
    const error = new Prisma.PrismaClientKnownRequestError("private details", {
      code: "P9999",
      clientVersion: "test",
    });
    expect(handleAndLogPrismaError(error)).toMatchObject({
      statusCode: 500,
      message: "Unknown database error",
    });
    expect(log.calls).toEqual([
      [{ dependency: "prisma", code: "unknown", status: 500 }, "Database operation failed"],
    ]);
  });
});
