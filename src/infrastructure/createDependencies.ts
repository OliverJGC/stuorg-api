import { PrismaClient } from "@prisma/client";

import { getRuntimeConfig } from "../config/runtimeConfig.js";
import { createOrganizationService } from "../modules/organizations/organizationService.js";
import type { ApplicationDependencies, RuntimeConfig } from "../types/config.js";
import { createSupabaseAuthClient } from "./auth/supabaseAuthClient.js";

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
  console.log("[createDependencies] called");
  const datasourceUrl = addDatabasePoolDefaults(config.databaseUrl);
  const auth = createSupabaseAuthClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  const database = new PrismaClient({ datasourceUrl });

  console.log("[createDependencies] initialized organization service");
  return { organizationService: createOrganizationService(database, auth) };
}

export const { organizationService } = createDependencies(getRuntimeConfig());
