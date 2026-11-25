import { Router } from "express";

import { createOrganizationController } from "./organizationController.js";
import type { OrganizationService } from "./organizationService.js";

export function createOrganizationRouter(service: OrganizationService): Router {
  const router = Router();
  const organizationController = createOrganizationController(service);

  router.post("/name-availability", organizationController.validateOrganizationNameController);
  router.post("/", organizationController.createOrganizationController);

  return router;
}
