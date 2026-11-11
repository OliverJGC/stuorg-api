import { Prisma } from "@prisma/client";

import { getLogger } from "../infrastructure/logging/logger.js";
import { HttpError } from "../types/httpError.js";

type ErrorMapping = {
  status: number;
  meaning: string;
};

const prismaErrors: Record<string, ErrorMapping> = {
  P2000: { status: 400, meaning: "Value too long for database column" },
  P2001: { status: 404, meaning: "Record does not exist" },
  P2002: { status: 409, meaning: "Unique constraint violation" },
  P2003: { status: 409, meaning: "Foreign key constraint violation" },
  P2011: { status: 400, meaning: "Null constraint violation" },
  P2014: { status: 409, meaning: "Required relation violation" },
  P2015: { status: 404, meaning: "Related record missing" },
  P2024: { status: 503, meaning: "Connection pool timeout" },
  P2025: {
    status: 404,
    meaning: "Record required for operation was not found",
  },
  P2028: { status: 500, meaning: "Transaction API error" },
  P2034: { status: 409, meaning: "Write conflict or deadlock" },
  P2037: { status: 503, meaning: "Too many database connections" },
};

export function handleAndLogPrismaError(error: unknown): HttpError {
  // Keep existing HTTP errors unchanged; the controller logs them when caught.
  if (error instanceof HttpError) {
    return error;
  }

  // For a known Prisma error, log its code and use the matching HTTP status.
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mapping = prismaErrors[error.code];
    getLogger().error(
      {
        dependency: "prisma",
        code: mapping ? error.code : "unknown",
        status: mapping?.status ?? 500,
      },
      "Database operation failed",
    );
    return new HttpError(mapping?.meaning ?? "Unknown database error", mapping?.status ?? 500);
  }

  // We don't recognize this error, so treat it as a database failure. Only call this helper around database operations.
  getLogger().error(
    { dependency: "prisma", code: "unknown", status: 500 },
    "Database operation failed",
  );
  return new HttpError("Unexpected database error", 500);
}
