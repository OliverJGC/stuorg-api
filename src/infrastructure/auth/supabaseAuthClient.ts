import type { AuthClient } from "../../types/config.js";
import { HttpError } from "../../utils/httpError.js";

type SupabaseUser = {
  id: string;
  email: string;
};

type SupabaseError = {
  code?: string;
  message?: string;
};

export function createSupabaseAuthClient(baseUrl: string, serviceRoleKey: string): AuthClient {
  console.log("[supabaseAuthClient] created");

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  return {
    async createUser(input): Promise<{ userId: string }> {
      console.log("[supabaseAuthClient.createUser] creating user in Supabase");

      let response: Response;
      try {
        response = await fetch(`${baseUrl}/auth/v1/admin/users`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            email: input.email,
            password: input.password,
            email_confirm: true,
          }),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create user";
        console.log("[supabaseAuthClient.createUser] Supabase request failed", error);
        throw new HttpError(message, 503);
      }

      if (!response.ok) {
        const error = (await response.json()) as SupabaseError;
        console.log("[supabaseAuthClient.createUser] Supabase user creation failed", error);

        throw new HttpError(
          error.message ?? "Failed to create user",
          response.status
        );
      }

      const user = (await response.json()) as SupabaseUser;

      console.log("[supabaseAuthClient.createUser] created user in Supabase");
      return { userId: user.id };
    },

    async deleteUser(userId): Promise<void> {
      console.log("[supabaseAuthClient.deleteUser] deleting user in Supabase");

      const response = await fetch(`${baseUrl}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        const error = (await response.json()) as SupabaseError;
        console.log("[supabaseAuthClient.deleteUser] Supabase user deletion failed", error);

        throw new HttpError(
          error.message ?? "Failed to delete user",
          response.status
        );
      }

      console.log("[supabaseAuthClient.deleteUser] deleted user in Supabase");
    }
  };
}
