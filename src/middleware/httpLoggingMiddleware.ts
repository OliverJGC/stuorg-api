import { randomUUID } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";

import { runWithLogger } from "../infrastructure/logging/logger.js";

export function createHttpLoggingMiddleware(logger: Logger): RequestHandler[] {
  const httpLogger = pinoHttp({
    logger,
    quietReqLogger: true,
    quietResLogger: true,
    genReqId(_request, response) {
      const requestId = randomUUID();
      response.setHeader("X-Request-ID", requestId);
      return requestId;
    },
    serializers: {
      req: () => undefined,
      res: () => undefined,
      err: () => undefined,
    },
    customAttributeKeys: { responseTime: "duration_ms" },
    customProps(request, response) {
      const route: unknown = (request as Request).route?.path;
      const prefix: unknown = (response as Response).locals.logRoutePrefix;

      return {
        method: request.method,
        route: typeof route === "string" ? `${typeof prefix === "string" ? prefix : ""}${route}` : "<unmatched>",
        status: response.statusCode,
      };
    },
    customLogLevel(request, response, error) {
      if (response.statusCode >= 500 || error) return "error";
      if (response.statusCode >= 400) return "warn";
      if (request.method === "OPTIONS" && response.statusCode >= 200 && response.statusCode < 300) return "silent";
      return "info";
    },
    customSuccessMessage: () => "Request completed",
    customErrorMessage: () => "Request failed",
  });
  const context: RequestHandler = (request, _response, next) => {
    runWithLogger(request.log, next);
  };

  return [httpLogger, context];
}
