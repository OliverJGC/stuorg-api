import type { ErrorRequestHandler } from "express";

import { API_MESSAGE } from "../utils/constants.js";

type ParserError = Error & {
  status?: number;
  type?: string;
};

export const requestErrorMiddleware: ErrorRequestHandler = (error: ParserError, _request, response, next) => {
  if (error instanceof SyntaxError && error.status === 400) {
    response.status(400).json({ message: API_MESSAGE.INVALID_JSON });
    return;
  }

  if (error.type === "entity.too.large") {
    response.status(413).json({ message: API_MESSAGE.PAYLOAD_TOO_LARGE });
    return;
  }

  if (error.type === "encoding.unsupported") {
    response.status(415).json({ message: API_MESSAGE.UNSUPPORTED_ENCODING });
    return;
  }

  next(error);
};
