import type { PrismaClient } from "@prisma/client";

import { getLogger } from "../../infrastructure/logging/logger.js";
import type { AuthClient } from "../../types/config.js";
import { handleAndLogPrismaError } from "../../utils/handleAndLogPrismaError.js";
import { HttpError } from "../../types/httpError.js";

export type OrgNameValidationResult = {
  name: string;
  available: boolean;
};

export type CreateOrganizationInput = {
  name: string;
  admin: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: string;
  };
};

export type OrganizationCreationResult = {
  organization: {
    id: string;
    name: string;
  };
  admin: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
};

export function createOrganizationService(database: PrismaClient, auth: AuthClient) {
  async function validateOrganizationName(name: string): Promise<OrgNameValidationResult> {
    try {
      const organization = await database.organization.findFirst({
        where: { name: { equals: name.trim(), mode: "insensitive" } },
        select: { id: true },
      });

      getLogger().info(
        { operation: "validateOrganizationName" },
        "[organizationService] Checked organization name availability",
      );
      return { name, available: organization === null };
    } catch (error) {
      throw handleAndLogPrismaError(error);
    }
  }

  async function createOrganization(
    input: CreateOrganizationInput,
  ): Promise<OrganizationCreationResult> {
    const name = input.name;
    const { firstName, lastName, email, password, role } = input.admin;
    const existingOrganization = await validateOrganizationName(name);

    if (!existingOrganization.available) {
      getLogger().warn(
        { operation: "createOrganization", status: 409 },
        "[organizationService] Organization name already exists",
      );
      throw new HttpError("Organization name already exists.", 409);
    }

    const authUser = await auth.createUser({ email, password });

    try {
      const organization = await database.$transaction(async (transaction) => {
        await transaction.user.create({
          data: {
            id: authUser.userId,
            firstName,
            lastName,
          },
        });
        const createdOrganization = await transaction.organization.create({ data: { name } });
        await transaction.membership.create({
          data: {
            userId: authUser.userId,
            organizationId: createdOrganization.id,
            role,
            isAdmin: true,
          },
        });
        return createdOrganization;
      });
      getLogger().info(
        { operation: "createOrganization" },
        "[organizationService] Created organization, user, and admin membership",
      );
      return {
        organization: { id: organization.id, name: organization.name },
        admin: {
          id: authUser.userId,
          firstName,
          lastName,
          email,
          role,
        },
      };
    } catch (error) {
      const httpError = handleAndLogPrismaError(error);
      getLogger().info(
        { operation: "createOrganization" },
        "[organizationService] Cleaning up Supabase user after failed transaction",
      );

      try {
        await auth.deleteUser(authUser.userId);
        getLogger().info(
          { operation: "createOrganization" },
          "[organizationService] Deleted Supabase user after failed transaction",
        );
      } catch {
        getLogger().error(
          { operation: "createOrganization" },
          "[organizationService] Supabase user cleanup failed",
        );
      }

      throw httpError;
    }
  }

  return { createOrganization, validateOrganizationName };
}

export type OrganizationService = ReturnType<typeof createOrganizationService>;
