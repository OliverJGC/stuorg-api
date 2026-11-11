import type { ErrorRequestHandler } from "express";

import { API_MESSAGE } from "../utils/constants.js";
import { getLogger } from "../infrastructure/logging/logger.js";

export const unexpectedErrorMiddleware: ErrorRequestHandler = (
  _error: unknown,
  _request,
  response,
  _next,
) => {
  getLogger().error({ status: 500 }, "Unexpected request failure");

  if (response.headersSent) {
    response.destroy();
    return;
  }

  response.status(500).json({ message: API_MESSAGE.INTERNAL_SERVER_ERROR });
};
