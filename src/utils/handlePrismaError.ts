import { Prisma } from "@prisma/client";

import { API_MESSAGE } from "./constants.js";
import { HttpError } from "./httpError.js";

type ErrorMapping = { status: number; message: string; meaning: string };

const prismaErrors: Record<string, ErrorMapping> = {
  P2000: { status: 400, message: API_MESSAGE.P2000, meaning: "Value too long for database column" },
  P2001: { status: 404, message: API_MESSAGE.P2001, meaning: "Record does not exist" },
  P2002: { status: 409, message: API_MESSAGE.P2002, meaning: "Unique constraint violation" },
  P2003: { status: 409, message: API_MESSAGE.P2003, meaning: "Foreign key constraint violation" },
  P2011: { status: 400, message: API_MESSAGE.P2011, meaning: "Null constraint violation" },
  P2014: { status: 409, message: API_MESSAGE.P2014, meaning: "Required relation violation" },
  P2015: { status: 404, message: API_MESSAGE.P2015, meaning: "Related record missing" },
  P2024: { status: 503, message: API_MESSAGE.P2024, meaning: "Connection pool timeout" },
  P2025: { status: 404, message: API_MESSAGE.P2025, meaning: "Record required for operation was not found" },
  P2028: { status: 500, message: API_MESSAGE.P2028, meaning: "Transaction API error" },
  P2034: { status: 409, message: API_MESSAGE.P2034, meaning: "Write conflict or deadlock" },
  P2037: { status: 503, message: API_MESSAGE.P2037, meaning: "Too many database connections" },
};

export function handlePrismaError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    const safeMessages: Record<number, string> = {
      400: API_MESSAGE.BAD_REQUEST,
      409: API_MESSAGE.CONFLICT,
      422: API_MESSAGE.UNPROCESSABLE_ENTITY,
      503: API_MESSAGE.SERVICE_UNAVAILABLE,
    };
    return new HttpError(safeMessages[error.statusCode] ?? API_MESSAGE.INTERNAL_SERVER_ERROR, error.statusCode);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mapping = prismaErrors[error.code];
    console.error(`[Prisma ${error.code}] ${mapping?.meaning ?? "Unknown Prisma error"}`, error.message);
    return new HttpError(mapping?.message ?? API_MESSAGE.DATABASE_OPERATION_FAILED, mapping?.status ?? 500);
  }

  console.error("[Prisma] Unexpected error:", error);
  return new HttpError(API_MESSAGE.INTERNAL_SERVER_ERROR, 500);
}
