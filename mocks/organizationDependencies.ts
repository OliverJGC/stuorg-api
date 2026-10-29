import { jest } from "@jest/globals";
import type { PrismaClient, Prisma } from "@prisma/client";

import type { AuthClient } from "../src/types/config.js";
import { createOrganizationService } from "../src/modules/organizations/organizationService.js";

export function createOrganizationDependencies() {
  const auth = {
    createUser: jest.fn<AuthClient["createUser"]>(),
    deleteUser: jest.fn<AuthClient["deleteUser"]>(),
  };
  const findFirst = jest.fn<(input: unknown) => Promise<{ id: string } | null>>();
  const transaction = jest.fn<(callback: (client: Prisma.TransactionClient) => Promise<unknown>) => Promise<unknown>>();
  const database = {
    $transaction: transaction,
    organization: { findFirst },
  } as unknown as PrismaClient;

  return {
    auth,
    database,
    findFirst,
    transaction,
    organizationService: createOrganizationService(database, auth),
  };
}
