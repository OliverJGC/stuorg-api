import { AsyncLocalStorage } from "node:async_hooks";
import { pino, type DestinationStream, type Logger, type LoggerOptions } from "pino";

import { getLoggingConfig } from "../../config/runtimeConfig.js";
import type { RuntimeConfig } from "../../types/config.js";

type LoggingConfig = Pick<RuntimeConfig, "environment" | "logLevel">;

export function createLogger(config: LoggingConfig, destination?: DestinationStream): Logger {
  const options: LoggerOptions = {
    level: config.logLevel,
    base: null,
    serializers: {
      err: () => undefined,
      error: () => undefined,
    },
    redact: {
      paths: [
        "password", "token", "accessToken", "refreshToken", "access_token", "refresh_token",
        "authorization", "cookie", "apikey", "serviceRoleKey", "supabaseServiceRoleKey", "databaseUrl",
        "*.password", "*.token", "*.accessToken", "*.refreshToken", "*.access_token", "*.refresh_token",
        "*.authorization", "*.cookie", "*.apikey", "*.serviceRoleKey", "*.supabaseServiceRoleKey", "*.databaseUrl",
        "req.headers", "req.body", "req.query", "res.headers",
      ],
      remove: true,
    },
  };

  if (config.environment === "development" && !destination) {
    options.transport = { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } };
  }

  return destination ? pino(options, destination) : pino(options);
}

const logger = createLogger(getLoggingConfig());
const loggerContext = new AsyncLocalStorage<Logger>();

export function getLogger(): Logger {
  return loggerContext.getStore() ?? logger;
}

export function runWithLogger<T>(requestLogger: Logger, callback: () => T): T {
  return loggerContext.run(requestLogger, callback);
}
