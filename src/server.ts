import { getLogger } from "./infrastructure/logging/logger.js";

import app, { config } from "./index.js";

app.listen(config.port, () => {
  getLogger().info({ port: config.port }, "Server listening");
});
