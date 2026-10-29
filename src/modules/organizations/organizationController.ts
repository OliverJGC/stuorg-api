import type { RequestHandler } from "express";

import { organizationService } from "../../infrastructure/createDependencies.js";
import { API_MESSAGE } from "../../utils/constants.js";
import { handlePrismaError } from "../../utils/handlePrismaError.js";
import { createOrganizationSchema, validateNameSchema } from "./organizationSchema.js";

export const validateOrganizationNameController: RequestHandler = async (request, response) => {
  console.log("[organizationController.validateOrganizationNameController] called to validate the organization name");

  const input = validateNameSchema.safeParse(request.body);
  if (!input.success) {
    console.log("[organizationController.validateOrganizationNameController] completed with invalid input", { status: 400 });
    response.status(400).json({ message: API_MESSAGE.INVALID_INPUT });
    return;
  }

  try {
    const result = await organizationService.validateOrganizationName(input.data.name);
    console.log("[organizationController.validateOrganizationNameController] validated organization name");
    response.status(200).json({ name: result.name, available: result.available });
  } catch (error) {
    console.log("[organizationController.validateOrganizationNameController] organization name validation failed");
    const httpError = handlePrismaError(error);
    response.status(httpError.statusCode).json({ message: httpError.message });
  }
};

export const createOrganizationController: RequestHandler = async (request, response) => {
  console.log("[organizationController.createOrganizationController] called to create an organization");
  const input = createOrganizationSchema.safeParse(request.body);
  if (!input.success) {
    console.log("[organizationController.createOrganizationController] completed with invalid input", { status: 400 });
    response.status(400).json({ message: API_MESSAGE.INVALID_INPUT });
    return;
  }

  try {
    const result = await organizationService.createOrganization(input.data);
    console.log("[organizationController.createOrganizationController] created organization");
    response.status(201).json(result);
  } catch (error) {
    console.log("[organizationController.createOrganizationController] organization creation failed");
    const httpError = handlePrismaError(error);
    response.status(httpError.statusCode).json({ message: httpError.message });
  }
};
