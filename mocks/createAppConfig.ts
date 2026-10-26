import type { RuntimeConfig } from "../src/config/runtimeConfig.js";

export const createAppConfig: RuntimeConfig = {
  corsOrigins: ["http://localhost:3000"],
  environment: "test",
  port: 5001,
};
