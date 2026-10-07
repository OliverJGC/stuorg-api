import { PrismaClient } from "@prisma/client";

import type { RuntimeConfig } from "../config/runtimeConfig.js";
import type { ApplicationDependencies } from "../types/config.js";

const DATABASE_POOL_DEFAULTS = {
  connect_timeout: "3",
  connection_limit: "1",
  pool_timeout: "3",
  socket_timeout: "3",
} as const;

function addDatabasePoolDefaults(databaseUrl: string): string {
  const url = new URL(databaseUrl);

  for (const [name, value] of Object.entries(DATABASE_POOL_DEFAULTS)) {
    if (!url.searchParams.has(name)) {
      url.searchParams.set(name, value);
    }
  }

  return url.toString();
}

export function createDependencies(config: RuntimeConfig): ApplicationDependencies {
  const datasourceUrl = config.databaseUrl ? addDatabasePoolDefaults(config.databaseUrl) : undefined;

  return {
    database: datasourceUrl ? new PrismaClient({ datasourceUrl }) : null,
  };
}
