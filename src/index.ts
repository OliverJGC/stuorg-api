import { getRuntimeConfig } from "./config/runtimeConfig.js";
import { createApp } from "./app.js";

export const config = getRuntimeConfig();
const app = createApp(config);

export default app;
