import type { RuntimeConfig } from "../src/types/config.js";

export const createAppConfig: RuntimeConfig = {
  corsOrigins: ["http://localhost:3000"],
  environment: "test",
  port: 5001,
  databaseUrl: "postgresql://test:test@localhost:5432/test",
  supabaseUrl: "https://project.supabase.co",
  supabaseServiceRoleKey: "test-service-role-key",
};
