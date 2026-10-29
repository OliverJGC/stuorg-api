import type { PrismaClient } from "@prisma/client";

import type { AuthClient } from "../../types/config.js";
import { HttpError } from "../../utils/httpError.js";

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
  organization: { id: string; name: string };
  admin: { id: string; firstName: string; lastName: string; email: string; role: string };
};

export function createOrganizationService(database: PrismaClient, auth: AuthClient) {
  async function validateOrganizationName(name: string): Promise<OrgNameValidationResult> {
    console.log("[createOrganizationService.validateOrganizationName] validating organization name");

    try {
      const organization = await database.organization.findFirst({
        where: { name: { equals: name.trim(), mode: "insensitive" } },
        select: { id: true },
      });

      console.log("[createOrganizationService.validateOrganizationName] validated organization name");
      return { name, available: organization === null };
    } catch (error) {
      console.log("[createOrganizationService.validateOrganizationName] organization name validation failed");
      throw error;
    }
  }

  async function createOrganization(input: CreateOrganizationInput): Promise<OrganizationCreationResult> {
    console.log("[createOrganizationService.createOrganization] creating organization");

    const name = input.name;
    const { firstName, lastName, email, password, role } = input.admin;

    const existingOrganization = await validateOrganizationName(name);

    if (!existingOrganization.available) {
      console.log("[createOrganizationService.createOrganization] organization name already exists");
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
        console.log("[createOrganizationService.createOrganization] created user");

        const createdOrganization = await transaction.organization.create({ data: { name } });
        console.log("[createOrganizationService.createOrganization] created organization");

        await transaction.membership.create({
          data: {
            userId: authUser.userId,
            organizationId: createdOrganization.id,
            role,
            isAdmin: true,
          },
        });
        console.log("[createOrganizationService.createOrganization] created membership");
        return createdOrganization;
      });

      console.log("[createOrganizationService.createOrganization] committed organization transaction");
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
      console.log("[createOrganizationService.createOrganization] organization transaction failed");
      try {
        await auth.deleteUser(authUser.userId);
        console.log("[createOrganizationService.createOrganization] deleted Supabase user after failed transaction");
      } catch {
        console.log("[createOrganizationService.createOrganization] Supabase user cleanup failed");
      }

      if (error instanceof HttpError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "Organization creation failed";
      throw new HttpError(message, 500);
    }
  }

  return { createOrganization, validateOrganizationName };
}

export type OrganizationService = ReturnType<typeof createOrganizationService>;
