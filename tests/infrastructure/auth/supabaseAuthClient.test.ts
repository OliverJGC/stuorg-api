import { jest } from "@jest/globals";

import { createSupabaseAuthClient } from "../../../src/infrastructure/auth/supabaseAuthClient.js";

describe("supabaseAuthClient", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates a confirmed Supabase user", async () => {
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      JSON.stringify({ id: "auth-user-id", email: "alex@miners.utep.edu" }),
      { status: 201 },
    ));
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

  it("throws the Supabase message and status for a failed user creation", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      JSON.stringify({ message: "Email already registered" }),
      { status: 409, statusText: "Conflict" },
    ));
    const authClient = createSupabaseAuthClient("https://project.supabase.co", "service-role-key");

    await expect(authClient.createUser({ email: "alex@miners.utep.edu", password: "example-password" }))
      .rejects.toMatchObject({ message: "Email already registered", status: 409 });
  });

  it("throws the original transport message with a service-unavailable status", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network unavailable"));
    const authClient = createSupabaseAuthClient("https://project.supabase.co", "service-role-key");

    await expect(authClient.createUser({ email: "alex@miners.utep.edu", password: "example-password" }))
      .rejects.toMatchObject({ message: "network unavailable", status: 503 });
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
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      JSON.stringify({ message: "User not found" }),
      { status: 404, statusText: "Not Found" },
    ));
    const authClient = createSupabaseAuthClient("https://project.supabase.co", "service-role-key");

    await expect(authClient.deleteUser("auth-user-id"))
      .rejects.toMatchObject({ message: "User not found", status: 404 });
  });
});
