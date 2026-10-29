import { Router } from "express";

import { createOrganizationController, validateOrganizationNameController } from "./organizationController.js";

export const organizationRouter = Router();

organizationRouter.post("/name-availability", validateOrganizationNameController);
organizationRouter.post("/", createOrganizationController);
