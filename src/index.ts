import { getRuntimeConfig } from "./config/runtimeConfig.js";
import { createApp } from "./createApp.js";
import { createDependencies } from "./services/createDependencies.js";

export const config = getRuntimeConfig();
export const dependencies = createDependencies(config);

const app = createApp(config);

export default app;
