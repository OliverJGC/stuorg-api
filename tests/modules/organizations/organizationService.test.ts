import { jest } from "@jest/globals";
import { Prisma } from "@prisma/client";

import { HttpError } from "../../../src/types/httpError.js";
import { createSupabaseAuthClient } from "../../../src/infrastructure/auth/supabaseAuthClient.js";
import { captureLogs } from "../../../mocks/captureLogs.js";
import { createOrganizationDependencies } from "../../../mocks/organizationDependencies.js";

describe("organizationService", () => {
  it("checks persisted organization names without regard to case", async () => {
    const dependencies = createOrganizationDependencies();
    dependencies.findFirst.mockResolvedValue({ id: "organization-id" });
    await expect(
      dependencies.organizationService.validateOrganizationName("Engineering Club"),
    ).resolves.toEqual({
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
    const createOrganization = jest
      .fn<
        () => Promise<{
          id: string;
          name: string;
        }>
      >()
      .mockResolvedValue({ id: "organization-id", name: "Engineering Club" });
    const createMembership = jest.fn();
    dependencies.transaction.mockImplementation(async (callback) =>
      callback({
        organization: { create: createOrganization },
        user: { create: createUser },
        membership: { create: createMembership },
      } as unknown as Prisma.TransactionClient),
    );
    await expect(
      dependencies.organizationService.createOrganization({
        name: "Engineering Club",
        admin: {
          firstName: "Alex",
          lastName: "Rivera",
          email: "alex@miners.utep.edu",
          password: "example-password",
          role: "President",
        },
      }),
    ).resolves.toEqual({
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
    await expect(
      dependencies.organizationService.createOrganization({
        name: "Engineering Club",
        admin: {
          firstName: "Alex",
          lastName: "Rivera",
          email: "alex@miners.utep.edu",
          password: "example-password",
          role: "President",
        },
      }),
    ).rejects.toMatchObject({ statusCode: 409, message: "Organization name already exists." });
    expect(dependencies.auth.createUser).not.toHaveBeenCalled();
    expect(dependencies.transaction).not.toHaveBeenCalled();
  });
  it("propagates an Auth creation failure without starting a database transaction", async () => {
    const dependencies = createOrganizationDependencies();
    const authError = new HttpError("Auth unavailable", 503);
    dependencies.findFirst.mockResolvedValue(null);
    dependencies.auth.createUser.mockRejectedValue(authError);
    await expect(
      dependencies.organizationService.createOrganization({
        name: "Engineering Club",
        admin: {
          firstName: "Alex",
          lastName: "Rivera",
          email: "alex@miners.utep.edu",
          password: "example-password",
          role: "President",
        },
      }),
    ).rejects.toBe(authError);
    expect(dependencies.transaction).not.toHaveBeenCalled();
    expect(dependencies.auth.deleteUser).not.toHaveBeenCalled();
  });
  it("propagates a name lookup failure before creating an Auth account", async () => {
    const dependencies = createOrganizationDependencies();
    const lookupError = new Error("database unavailable");
    dependencies.findFirst.mockRejectedValue(lookupError);
    await expect(
      dependencies.organizationService.createOrganization({
        name: "Engineering Club",
        admin: {
          firstName: "Alex",
          lastName: "Rivera",
          email: "alex@miners.utep.edu",
          password: "example-password",
          role: "President",
        },
      }),
    ).rejects.toMatchObject({ statusCode: 500, message: "Unexpected database error" });
    expect(dependencies.auth.createUser).not.toHaveBeenCalled();
  });
  it("deletes the newly-created Auth account when the database transaction fails", async () => {
    const dependencies = createOrganizationDependencies();
    dependencies.auth.createUser.mockResolvedValue({ userId: "auth-user-id" });
    dependencies.auth.deleteUser.mockResolvedValue(undefined);
    dependencies.findFirst.mockResolvedValue(null);
    dependencies.transaction.mockRejectedValue(new Error("database unavailable"));
    await expect(
      dependencies.organizationService.createOrganization({
        name: "Engineering Club",
        admin: {
          firstName: "Alex",
          lastName: "Rivera",
          email: "alex@miners.utep.edu",
          password: "example-password",
          role: "President",
        },
      }),
    ).rejects.toMatchObject({ message: "Unexpected database error", statusCode: 500 });
    expect(dependencies.auth.deleteUser).toHaveBeenCalledWith("auth-user-id");
  });
  it("does not mask a transaction failure when Auth cleanup fails", async () => {
    const dependencies = createOrganizationDependencies();
    dependencies.auth.createUser.mockResolvedValue({ userId: "auth-user-id" });
    dependencies.auth.deleteUser.mockRejectedValue(new Error("cleanup unavailable"));
    dependencies.findFirst.mockResolvedValue(null);
    dependencies.transaction.mockRejectedValue(new Error("database unavailable"));
    await expect(
      dependencies.organizationService.createOrganization({
        name: "Engineering Club",
        admin: {
          firstName: "Alex",
          lastName: "Rivera",
          email: "alex@miners.utep.edu",
          password: "example-password",
          role: "President",
        },
      }),
    ).rejects.toMatchObject({ message: "Unexpected database error", statusCode: 500 });
  });
  it("uses a generic transaction error for a non-Error failure", async () => {
    const dependencies = createOrganizationDependencies();
    dependencies.auth.createUser.mockResolvedValue({ userId: "auth-user-id" });
    dependencies.auth.deleteUser.mockResolvedValue(undefined);
    dependencies.findFirst.mockResolvedValue(null);
    dependencies.transaction.mockRejectedValue("database unavailable");
    await expect(
      dependencies.organizationService.createOrganization({
        name: "Engineering Club",
        admin: {
          firstName: "Alex",
          lastName: "Rivera",
          email: "alex@miners.utep.edu",
          password: "example-password",
          role: "President",
        },
      }),
    ).rejects.toMatchObject({ message: "Unexpected database error", statusCode: 500 });
    expect(dependencies.auth.deleteUser).toHaveBeenCalledWith("auth-user-id");
  });
  it("marks an unclaimed organization name as available", async () => {
    const dependencies = createOrganizationDependencies();
    dependencies.findFirst.mockResolvedValue(null);
    await expect(
      dependencies.organizationService.validateOrganizationName("Engineering Club"),
    ).resolves.toEqual({
      name: "Engineering Club",
      available: true,
    });
  });
});

describe("organization dependency error propagation", () => {
  afterEach(() => jest.restoreAllMocks());
  it("logs and propagates an auth creation failure before database writes or cleanup", async () => {
    const log = captureLogs();
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ message: "Original auth failure" }), { status: 422 }),
      );
    const dependencies = createOrganizationDependencies();
    const auth = createSupabaseAuthClient("https://project.supabase.co", "service-role-key");
    dependencies.auth.createUser.mockImplementation(auth.createUser);
    dependencies.findFirst.mockResolvedValue(null);
    await expect(
      dependencies.organizationService.createOrganization({
        name: "Club",
        admin: {
          firstName: "Alex",
          lastName: "Rivera",
          email: "a@utep.edu",
          password: "secret",
          role: "President",
        },
      }),
    ).rejects.toMatchObject({ statusCode: 422, message: "Auth request failed" });
    expect(dependencies.transaction).not.toHaveBeenCalled();
    expect(dependencies.auth.deleteUser).not.toHaveBeenCalled();
    expect(log.calls.filter(([fields]) => fields.dependency === "supabase")).toHaveLength(1);
    expect(log.calls).toContainEqual([
      expect.objectContaining({ operation: "createUser", status: 422 }),
      "Supabase operation failed",
    ]);
    expect(JSON.stringify(log.calls)).not.toContain("Original auth failure");
  });
  it.each([false, true])("preserves Prisma status when cleanup fails: %s", async (cleanupFails) => {
    const log = captureLogs();
    const fetch = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "auth-user-id" }), { status: 201 }))
      .mockResolvedValueOnce(
        cleanupFails
          ? new Response(
              JSON.stringify({ message: "Deletion unavailable", code: "unexpected_failure" }),
              { status: 503 },
            )
          : new Response(null, { status: 204 }),
      );
    const dependencies = createOrganizationDependencies();
    const auth = createSupabaseAuthClient("https://project.supabase.co", "service-role-key");
    dependencies.auth.createUser.mockImplementation(auth.createUser);
    dependencies.auth.deleteUser.mockImplementation(auth.deleteUser);
    dependencies.findFirst.mockResolvedValue(null);
    dependencies.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Original unique failure", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    await expect(
      dependencies.organizationService.createOrganization({
        name: "Club",
        admin: {
          firstName: "Alex",
          lastName: "Rivera",
          email: "a@utep.edu",
          password: "secret",
          role: "President",
        },
      }),
    ).rejects.toMatchObject({ statusCode: 409, message: "Unique constraint violation" });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(log.calls.filter(([, message]) => message === "Database operation failed")).toHaveLength(
      1,
    );
    expect(log.calls).toContainEqual([
      expect.objectContaining({ code: "P2002", status: 409 }),
      "Database operation failed",
    ]);
    expect(JSON.stringify(log.calls)).not.toMatch(/Original unique failure|Deletion unavailable/);
    const deletionLogs = log.calls.filter(
      ([fields, message]) =>
        message === "Supabase operation failed" &&
        typeof fields === "object" &&
        fields !== null &&
        "operation" in fields &&
        fields.operation === "deleteUser",
    );
    expect(deletionLogs).toHaveLength(cleanupFails ? 1 : 0);

    if (cleanupFails) {
      expect(deletionLogs[0]?.[0]).toMatchObject({ status: 503, operation: "deleteUser" });
    }
  });
});
