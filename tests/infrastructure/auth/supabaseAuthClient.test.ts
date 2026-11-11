import { jest } from "@jest/globals";

import { captureLogs } from "../../../mocks/captureLogs.js";
import { createSupabaseAuthClient } from "../../../src/infrastructure/auth/supabaseAuthClient.js";

describe("supabaseAuthClient", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });
  it("creates a confirmed Supabase user", async () => {
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "auth-user-id", email: "alex@miners.utep.edu" }), { status: 201 }));
    const authClient = createSupabaseAuthClient("https://project.supabase.co", "service-role-key");
    await expect(authClient.createUser({
      email: "alex@miners.utep.edu",
      password: "example-password",
    })).resolves.toEqual({ userId: "auth-user-id" });
    expect(fetch).toHaveBeenCalledWith("https://project.supabase.co/auth/v1/admin/users", {
      method: "POST",
      headers: {
        apikey: "service-role-key",
        Authorization: "Bearer service-role-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "alex@miners.utep.edu",
        password: "example-password",
        email_confirm: true,
      }),
    });
  });
  it("rejects an unreadable successful user response", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not json", { status: 201 }));
    const client = createSupabaseAuthClient("https://project.supabase.co", "service-role-key");
    await expect(client.createUser({ email: "a@example.com", password: "password" }))
      .rejects.toMatchObject({ statusCode: 500, message: "Invalid auth service response" });
  });
  it("uses a fixed message and preserves the status for a failed user creation", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "Email already registered" }), { status: 409, statusText: "Conflict" }));
    const authClient = createSupabaseAuthClient("https://project.supabase.co", "service-role-key");
    await expect(authClient.createUser({ email: "alex@miners.utep.edu", password: "example-password" }))
      .rejects.toMatchObject({ message: "Auth request failed", status: 409 });
  });
  it("translates a transport failure to a service-unavailable error", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network unavailable"));
    const authClient = createSupabaseAuthClient("https://project.supabase.co", "service-role-key");
    await expect(authClient.createUser({ email: "alex@miners.utep.edu", password: "example-password" }))
      .rejects.toMatchObject({ message: "Auth service unavailable", status: 503 });
  });
  it("deletes a Supabase user", async () => {
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    const authClient = createSupabaseAuthClient("https://project.supabase.co", "service-role-key");
    await expect(authClient.deleteUser("auth-user-id")).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith("https://project.supabase.co/auth/v1/admin/users/auth-user-id", {
      method: "DELETE",
      headers: {
        apikey: "service-role-key",
        Authorization: "Bearer service-role-key",
        "Content-Type": "application/json",
      },
    });
  });
  it("preserves the Supabase status when user deletion fails", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "User not found" }), { status: 404, statusText: "Not Found" }));
    const authClient = createSupabaseAuthClient("https://project.supabase.co", "service-role-key");
    await expect(authClient.deleteUser("auth-user-id"))
      .rejects.toMatchObject({ message: "Auth request failed", status: 404 });
  });
});

describe("Supabase failure boundaries", () => {
  type Client = ReturnType<typeof createSupabaseAuthClient>;
  const operations: Array<[
    string,
    (client: Client) => Promise<unknown>
  ]> = [
      [
        "createUser", (client) => client.createUser({ email: "alex@utep.edu", password: "private-password" })
      ],
      ["deleteUser", (client) => client.deleteUser("user-id")],
    ];
  let log: ReturnType<typeof captureLogs>;

  beforeEach(() => { log = captureLogs(); });
  afterEach(() => jest.restoreAllMocks());
  it.each(operations)("%s translates transport failures and logs the original diagnostic once", async (operation, call) => {
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network unreachable"));
    const client = createSupabaseAuthClient("https://project.supabase.co", "service-role-key");
    await expect(call(client)).rejects.toMatchObject({ statusCode: 503, message: "Auth service unavailable" });
    expect(log.calls).toHaveLength(1);
    expect(log.calls).toContainEqual([expect.objectContaining({ operation, status: 503 }), "Supabase request failed"]);
    expect(JSON.stringify(log.calls)).not.toContain("Network unreachable");
  });
  it.each(operations)("%s preserves HTTP statuses when the provider body cannot be read", async (_operation, call) => {
    const fetch = jest.spyOn(globalThis, "fetch");
    const client = createSupabaseAuthClient("https://project.supabase.co", "service-role-key");

    for (const body of [null, "<html>Unavailable</html>", "null", "{}", '"error"']) {
      fetch.mockResolvedValueOnce(new Response(body, { status: 429 }));
      await expect(call(client)).rejects.toMatchObject({ statusCode: 429, message: "Auth request failed" });
    }

    expect(log.calls).toHaveLength(5);
  });
  it.each(operations)("%s preserves non-authentication HTTP statuses and omits error payloads", async (operation, call) => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      message: "Provider unavailable",
      code: "unexpected_failure",
      password: "raw-secret",
      token: "raw-token",
    }), { status: 500 }));
    const client = createSupabaseAuthClient("https://project.supabase.co", "service-role-key");
    let error: unknown;

    try {
      await call(client);
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({ status: 500, statusCode: 500, message: "Auth request failed" });
    expect(error).not.toHaveProperty("cause");
    expect(error).not.toHaveProperty("providerStatus");
    expect(error).not.toHaveProperty("providerCode");
    expect(log.calls).toHaveLength(1);
    expect(log.calls).toContainEqual([expect.objectContaining({ operation, status: 500, errorCode: "unexpected_failure" }), "Supabase operation failed"]);
    expect(JSON.stringify(log.calls)).not.toMatch(/raw-secret|raw-token|Provider unavailable/);
  });
  it("redacts supplied credentials from original error messages", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Failed for private-password at https://project.supabase.co using service-role-key"));
    const client = createSupabaseAuthClient("https://project.supabase.co", "service-role-key");
    await expect(client.createUser({ email: "a@utep.edu", password: "private-password" })).rejects.toMatchObject({ statusCode: 503 });
    expect(JSON.stringify(log.calls)).not.toMatch(/private-password|service-role-key|https:/);
  });
});
