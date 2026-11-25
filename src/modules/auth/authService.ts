import type { PrismaClient } from "@prisma/client";

import { HttpError } from "../../types/httpError.js";
import type { AuthSession, Membership, ProviderSession, SessionUser } from "./types.js";
import { getLogger } from "../../infrastructure/logging/logger.js";

export function createAuthService(database: PrismaClient, baseUrl: string, apiKey: string) {
  async function providerRequest(path: string, options: RequestInit): Promise<Response> {
    try {
      return await fetch(`${baseUrl}/auth/v1/${path}`, {
        ...options,
        headers: { apikey: apiKey, "Content-Type": "application/json", ...options.headers },
      });
    } catch {
      getLogger().error(
        { operation: "authRequest", status: 503 },
        "[authService] Auth service unavailable",
      );
      throw new HttpError("Auth service unavailable", 503);
    }
  }

  async function sessionRequest(body: object, grant: string): Promise<AuthSession> {
    const response = await providerRequest(`token?grant_type=${grant}`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      getLogger().warn(
        {
          operation: "sessionRequest",
          status: response.status >= 500 ? 503 : response.status === 429 ? 429 : 401,
        },
        "[authService] Auth provider rejected session request",
      );
      throw new HttpError(
        "Authentication failed",
        response.status >= 500 ? 503 : response.status === 429 ? 429 : 401,
      );
    }
    let data: ProviderSession;

    try {
      data = (await response.json()) as ProviderSession;
      if (
        typeof data.access_token !== "string" ||
        typeof data.refresh_token !== "string" ||
        !Number.isFinite(data.expires_in) ||
        data.expires_in <= 0
      ) {
        throw new Error();
      }
    } catch {
      getLogger().error(
        { operation: "sessionRequest", status: 503 },
        "[authService] Auth provider returned an invalid session",
      );
      throw new HttpError("Invalid auth service response", 503);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async function getUser(accessToken: string): Promise<string | null> {
    const response = await providerRequest("user", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 401 || response.status === 403) {
      getLogger().info(
        { operation: "getUser", status: 401 },
        "[authService] Access token rejected",
      );
      return null;
    }

    if (!response.ok) {
      getLogger().error(
        { operation: "getUser", status: 503 },
        "[authService] Auth provider user lookup failed",
      );
      throw new HttpError("Auth service unavailable", 503);
    }

    let user: { id?: unknown };

    try {
      user = (await response.json()) as { id?: unknown };
    } catch {
      getLogger().error(
        { operation: "getUser", status: 503 },
        "[authService] Auth provider returned invalid user data",
      );
      throw new HttpError("Invalid auth service response", 503);
    }

    if (typeof user.id !== "string" || !user.id) {
      getLogger().error(
        { operation: "getUser", status: 503 },
        "[authService] Auth provider returned invalid user data",
      );
      throw new HttpError("Invalid auth service response", 503);
    }

    return user.id;
  }

  return {
    signIn(email: string, password: string): Promise<AuthSession> {
      return sessionRequest({ email, password }, "password");
    },

    async restore(
      accessToken: string | undefined,
      refreshToken: string | undefined,
    ): Promise<{
      user: SessionUser;
      memberships: Membership[];
      refreshedSession: AuthSession | undefined;
    }> {
      let userId = accessToken ? await getUser(accessToken) : null;
      let refreshedSession: AuthSession | undefined;

      if (!userId && refreshToken) {
        refreshedSession = await sessionRequest({ refresh_token: refreshToken }, "refresh_token");
        userId = await getUser(refreshedSession.accessToken);
      }

      if (!userId) {
        getLogger().warn({ operation: "restore", status: 401 }, "[authService] Session expired");
        throw new HttpError("Session expired", 401);
      }

      const user = await database.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, firstName: true, lastName: true },
      });

      const rows = await database.membership.findMany({
        where: { userId: user.id },
        select: {
          organizationId: true,
          organization: { select: { name: true } },
          role: true,
          isAdmin: true,
        },
        orderBy: { organization: { name: "asc" } },
      });

      const memberships = rows.map((row) => ({
        id: row.organizationId,
        name: row.organization.name,
        role: row.role,
        isAdmin: row.isAdmin,
      }));

      getLogger().info({ operation: "restore" }, "[authService] Restored session and memberships");
      return { user, memberships, refreshedSession };
    },

    async signOut(
      accessToken: string | undefined,
      refreshToken: string | undefined,
    ): Promise<void> {
      let token = accessToken;

      if ((!token || !(await getUser(token))) && refreshToken) {
        try {
          token = (await sessionRequest({ refresh_token: refreshToken }, "refresh_token"))
            .accessToken;
        } catch (error) {
          if (error instanceof HttpError && error.statusCode === 401) {
            return;
          }
          throw error;
        }
      }

      if (!token) {
        return;
      }

      const response = await providerRequest("logout?scope=local", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok && response.status !== 401 && response.status !== 403) {
        getLogger().error(
          { operation: "signOut", status: 503 },
          "[authService] Auth provider logout failed",
        );
        throw new HttpError("Auth service unavailable", 503);
      }

      getLogger().info({ operation: "signOut" }, "[authService] Signed out session");
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
