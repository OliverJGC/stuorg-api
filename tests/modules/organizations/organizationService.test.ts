import { jest } from "@jest/globals";
import type { Prisma } from "@prisma/client";

import { createOrganizationDependencies } from "../../../mocks/organizationDependencies.js";

describe("organizationService", () => {
  it("checks persisted organization names without regard to case", async () => {
    const dependencies = createOrganizationDependencies();
    dependencies.findFirst.mockResolvedValue({ id: "organization-id" });

    await expect(dependencies.organizationService.validateOrganizationName("Engineering Club")).resolves.toEqual({
      name: "Engineering Club",
      available: false,
    });
    expect(dependencies.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: "Engineering Club", mode: "insensitive" } },
      select: { id: true },
    });
  });

  it("creates the Auth account and all application records in one transaction", async () => {
    const dependencies = createOrganizationDependencies();
    dependencies.auth.createUser.mockResolvedValue({ userId: "auth-user-id" });
    dependencies.findFirst.mockResolvedValue(null);
    const createUser = jest.fn();
    const createOrganization = jest.fn<() => Promise<{ id: string; name: string }>>()
      .mockResolvedValue({ id: "organization-id", name: "Engineering Club" });
    const createMembership = jest.fn();
    dependencies.transaction.mockImplementation(async (callback) => callback({
      organization: { create: createOrganization },
      user: { create: createUser },
      membership: { create: createMembership },
    } as unknown as Prisma.TransactionClient));

    await expect(dependencies.organizationService.createOrganization({
      name: "Engineering Club",
      admin: {
        firstName: "Alex",
        lastName: "Rivera",
        email: "alex@miners.utep.edu",
        password: "example-password",
        role: "President",
      },
    })).resolves.toEqual({
      organization: { id: "organization-id", name: "Engineering Club" },
      admin: {
        id: "auth-user-id",
        firstName: "Alex",
        lastName: "Rivera",
        email: "alex@miners.utep.edu",
        role: "President",
      },
    });
    expect(dependencies.auth.createUser).toHaveBeenCalledWith({
      email: "alex@miners.utep.edu",
      password: "example-password",
    });
    expect(createUser).toHaveBeenCalledWith({
      data: { id: "auth-user-id", firstName: "Alex", lastName: "Rivera" },
    });
    expect(createOrganization).toHaveBeenCalledWith({ data: { name: "Engineering Club" } });
    expect(createMembership).toHaveBeenCalledWith({
      data: {
        userId: "auth-user-id",
        organizationId: "organization-id",
        role: "President",
        isAdmin: true,
      },
    });
  });

  it("rejects a duplicate organization name before creating an Auth account", async () => {
    const dependencies = createOrganizationDependencies();
    dependencies.findFirst.mockResolvedValue({ id: "organization-id" });

    await expect(dependencies.organizationService.createOrganization({
      name: "Engineering Club",
      admin: {
        firstName: "Alex",
        lastName: "Rivera",
        email: "alex@miners.utep.edu",
        password: "example-password",
        role: "President",
      },
    })).rejects.toMatchObject({ statusCode: 409, message: "Organization name already exists." });
    expect(dependencies.auth.createUser).not.toHaveBeenCalled();
    expect(dependencies.transaction).not.toHaveBeenCalled();
  });

  it("propagates an Auth creation failure without starting a database transaction", async () => {
    const dependencies = createOrganizationDependencies();
    const authError = new Error("Auth unavailable");
    dependencies.findFirst.mockResolvedValue(null);
    dependencies.auth.createUser.mockRejectedValue(authError);

    await expect(dependencies.organizationService.createOrganization({
      name: "Engineering Club",
      admin: {
        firstName: "Alex",
        lastName: "Rivera",
        email: "alex@miners.utep.edu",
        password: "example-password",
        role: "President",
      },
    })).rejects.toBe(authError);
    expect(dependencies.transaction).not.toHaveBeenCalled();
  });

  it("propagates a name lookup failure before creating an Auth account", async () => {
    const dependencies = createOrganizationDependencies();
    const lookupError = new Error("database unavailable");
    dependencies.findFirst.mockRejectedValue(lookupError);

    await expect(dependencies.organizationService.createOrganization({
      name: "Engineering Club",
      admin: {
        firstName: "Alex",
        lastName: "Rivera",
        email: "alex@miners.utep.edu",
        password: "example-password",
        role: "President",
      },
    })).rejects.toBe(lookupError);
    expect(dependencies.auth.createUser).not.toHaveBeenCalled();
  });

  it("deletes the newly-created Auth account when the database transaction fails", async () => {
    const dependencies = createOrganizationDependencies();
    dependencies.auth.createUser.mockResolvedValue({ userId: "auth-user-id" });
    dependencies.auth.deleteUser.mockResolvedValue(undefined);
    dependencies.findFirst.mockResolvedValue(null);
    dependencies.transaction.mockRejectedValue(new Error("database unavailable"));

    await expect(dependencies.organizationService.createOrganization({
      name: "Engineering Club",
      admin: {
        firstName: "Alex",
        lastName: "Rivera",
        email: "alex@miners.utep.edu",
        password: "example-password",
        role: "President",
      },
    })).rejects.toMatchObject({ message: "database unavailable", statusCode: 500 });
    expect(dependencies.auth.deleteUser).toHaveBeenCalledWith("auth-user-id");
  });

  it("does not mask a transaction failure when Auth cleanup fails", async () => {
    const dependencies = createOrganizationDependencies();
    dependencies.auth.createUser.mockResolvedValue({ userId: "auth-user-id" });
    dependencies.auth.deleteUser.mockRejectedValue(new Error("cleanup unavailable"));
    dependencies.findFirst.mockResolvedValue(null);
    dependencies.transaction.mockRejectedValue(new Error("database unavailable"));

    await expect(dependencies.organizationService.createOrganization({
      name: "Engineering Club",
      admin: {
        firstName: "Alex",
        lastName: "Rivera",
        email: "alex@miners.utep.edu",
        password: "example-password",
        role: "President",
      },
    })).rejects.toMatchObject({ message: "database unavailable", statusCode: 500 });
  });

  it("uses a generic transaction error for a non-Error failure", async () => {
    const dependencies = createOrganizationDependencies();
    dependencies.auth.createUser.mockResolvedValue({ userId: "auth-user-id" });
    dependencies.auth.deleteUser.mockResolvedValue(undefined);
    dependencies.findFirst.mockResolvedValue(null);
    dependencies.transaction.mockRejectedValue("database unavailable");

    await expect(dependencies.organizationService.createOrganization({
      name: "Engineering Club",
      admin: {
        firstName: "Alex",
        lastName: "Rivera",
        email: "alex@miners.utep.edu",
        password: "example-password",
        role: "President",
      },
    })).rejects.toMatchObject({ message: "Organization creation failed", statusCode: 500 });
    expect(dependencies.auth.deleteUser).toHaveBeenCalledWith("auth-user-id");
  });

  it("marks an unclaimed organization name as available", async () => {
    const dependencies = createOrganizationDependencies();
    dependencies.findFirst.mockResolvedValue(null);

    await expect(dependencies.organizationService.validateOrganizationName("Engineering Club")).resolves.toEqual({
      name: "Engineering Club", available: true,
    });
  });
});
