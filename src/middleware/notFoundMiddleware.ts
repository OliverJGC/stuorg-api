import type { RequestHandler } from "express";

import { API_MESSAGE } from "../utils/constants.js";

export const notFoundMiddleware: RequestHandler = (_request, response) => {
  response.status(404).json({ message: API_MESSAGE.NOT_FOUND });
};
