import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { Logger } from "pino";

import { createLogger } from "./infrastructure/logging/logger.js";
import { createHttpLoggingMiddleware } from "./middleware/httpLoggingMiddleware.js";
import { notFoundMiddleware } from "./middleware/notFoundMiddleware.js";
import { unexpectedErrorMiddleware } from "./middleware/unexpectedErrorMiddleware.js";
import { requestErrorMiddleware } from "./middleware/requestErrorMiddleware.js";
import { authService } from "./infrastructure/createDependencies.js";
import { createAuthRouter } from "./modules/auth/authRoutes.js";
import { organizationRouter } from "./modules/organizations/organizationRoutes.js";
import type { RuntimeConfig } from "./types/config.js";

export function createApp(
  config: RuntimeConfig,
  logger: Logger = createLogger(config),
): express.Express {
  const app = express();
  app.use(...createHttpLoggingMiddleware(logger));
  app.disable("x-powered-by");
  app.set("trust proxy", false);
  app.use(helmet());
  app.use(
    cors({
      allowedHeaders: ["Authorization", "Content-Type"],
      credentials: true,
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
    }),
  );
  app.use(express.json({ inflate: false, limit: "100kb" }));
  app.use("/auth", createAuthRouter(authService, config));
  app.use(
    "/internal/organizations",
    (_request, response, next) => {
      response.locals.logRoutePrefix = "/internal/organizations";
      next();
    },
    organizationRouter,
  );
  app.use(requestErrorMiddleware);
  app.use(notFoundMiddleware);
  app.use(unexpectedErrorMiddleware);
  return app;
}
