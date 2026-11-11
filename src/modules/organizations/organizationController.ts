import type { RequestHandler } from "express";

import { organizationService } from "../../infrastructure/createDependencies.js";
import { API_MESSAGE } from "../../utils/constants.js";
import { HttpError } from "../../types/httpError.js";
import { getHttpErrorMessage } from "../../utils/errorHelpers.js";
import { getLogger } from "../../infrastructure/logging/logger.js";
import { createOrganizationSchema, validateNameSchema } from "./organizationSchema.js";

export const validateOrganizationNameController: RequestHandler = async (request, response) => {
  const input = validateNameSchema.safeParse(request.body);

  if (!input.success) {
    getLogger().warn({ operation: "validateOrganizationNameController", status: 400 }, "[organizationController] Request validation failed");
    response.status(400).json({ message: API_MESSAGE.INVALID_INPUT });
    return;
  }

  try {
    const result = await organizationService.validateOrganizationName(input.data.name);
    getLogger().info({ operation: "validateOrganizationNameController", status: 200 }, "[organizationController] Returning organization name availability response");

    if (!result.available) {
      return response.status(200).json({
        name: result.name,
        available: false,
        message: API_MESSAGE.ORGANIZATION_NAME_TAKEN
      });
    }

    return response.status(200).json({
      name: result.name,
      available: true
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.statusCode : 500;

    getLogger().error({ operation: "validateOrganizationNameController", status }, "[organizationController] Organization name validation failed");

    response.status(status).json({
      message: getHttpErrorMessage(status)
    });
  }
};

export const createOrganizationController: RequestHandler = async (request, response) => {
  const input = createOrganizationSchema.safeParse(request.body);

  if (!input.success) {
    getLogger().warn({ operation: "createOrganizationController", status: 400 }, "[organizationController] Request validation failed");
    response.status(400).json({ message: API_MESSAGE.INVALID_INPUT });
    return;
  }

  try {
    const result = await organizationService.createOrganization(input.data);
    getLogger().info({ operation: "createOrganizationController", status: 201 }, "[organizationController] Returning organization creation response");
    response.status(201).json(result);
  } catch (error) {
    const status = error instanceof HttpError ? error.statusCode : 500;

    getLogger().error({ operation: "createOrganizationController", status }, "[organizationController] Organization creation failed");

    response.status(status).json({
      message: getHttpErrorMessage(status)
    });
  }
};
