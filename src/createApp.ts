import cors from "cors";
import express from "express";
import helmet from "helmet";

import type { RuntimeConfig } from "./config/runtimeConfig.js";
import { notFoundMiddleware } from "./middleware/notFoundMiddleware.js";

export function createApp(config: RuntimeConfig): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", false);
  app.use(helmet());
  app.use(cors({
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: false,
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  }));
  app.use(express.json({ inflate: false, limit: "100kb" }));
  app.use(notFoundMiddleware);

  return app;
}
