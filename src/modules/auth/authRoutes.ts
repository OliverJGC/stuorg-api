import { Router } from "express";

import type { RuntimeConfig } from "../../types/config.js";
import { API_MESSAGE } from "../../utils/constants.js";
import { createAuthController } from "./authController.js";
import type { AuthService } from "./authService.js";

export function createAuthRouter(
  service: AuthService,
  config: Pick<RuntimeConfig, "environment" | "corsOrigins">,
): Router {
  const router = Router();
  const authController = createAuthController(service, config);

  router.use((request, response, next) => {
    const origin = request.get("Origin");

    if (!origin || !config.corsOrigins.includes(origin)) {
      response.status(403).json({ message: API_MESSAGE.FORBIDDEN });
      return;
    }

    next();
  });

  router.post("/sign-in", authController.signInController);
  router.get("/session", authController.restoreSessionController);
  router.post("/sign-out", authController.signOutController);

  return router;
}
