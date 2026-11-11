import type { AuthClient } from "../../types/config.js";
import { getLogger } from "../logging/logger.js";
import { HttpError } from "../../types/httpError.js";
import { getSafeSupabaseAuthError } from "../../utils/errorHelpers.js";

type SupabaseUser = {
  id: string;
  email?: string;
};

type SupabaseError = {
  code?: string;
  message: string;
};

const SUPABASE_ERROR_CODES = new Set([
  "invalid_credentials", "refresh_token_not_found", "refresh_token_already_used", "session_not_found",
  "session_expired", "bad_jwt", "no_authorization", "user_not_found", "email_exists", "user_already_exists",
  "email_not_confirmed", "weak_password", "validation_failed", "over_request_rate_limit",
  "over_email_send_rate_limit", "unexpected_failure",
]);

export function createSupabaseAuthClient(baseUrl: string, serviceRoleKey: string): AuthClient {
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  async function authRequest(path: string, options: RequestInit, operation: string) {
    try {
      return await fetch(`${baseUrl}/auth/v1/${path}`, {
        ...options,
        headers: {
          apikey: serviceRoleKey,
          "Content-Type": "application/json",
          ...options.headers
        },
      });
    } catch {
      getLogger().error({ dependency: "supabase", operation, status: 503 }, "Supabase request failed");
      throw new HttpError("Auth service unavailable", 503);
    }
  }

  async function handleSupabaseError(response: Response, operation: string): Promise<SupabaseError> {
    const error = await getSafeSupabaseAuthError(response);

    const log = getLogger();
    const level = response.status >= 500 ? "error" : "warn";
    log[level]({
      dependency: "supabase",
      operation,
      status: response.status,
      errorCode: error.code && SUPABASE_ERROR_CODES.has(error.code) ? error.code : "unknown",
    }, "Supabase operation failed");
    return error;
  }

  return {
    async createUser(input) {
      const response = await authRequest("admin/users", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: input.email,
          password: input.password,
          email_confirm: true
        }),
      }, "createUser");

      if (!response.ok) {
        const error = await handleSupabaseError(response, "createUser");
        throw new HttpError(error.message, response.status);
      }

      let user: SupabaseUser;
      try {
        user = await response.json() as SupabaseUser;
      } catch {
        getLogger().error({ dependency: "supabase", operation: "createUser", status: 500 }, "Supabase response could not be read");
        throw new HttpError("Invalid auth service response", 500);
      }

      return { userId: user.id };
    },

    async deleteUser(userId) {
      const response = await authRequest(`admin/users/${userId}`, { method: "DELETE", headers }, "deleteUser");

      if (!response.ok) {
        const error = await handleSupabaseError(response, "deleteUser");
        throw new HttpError(error.message, response.status);
      }
    },
  };
}
