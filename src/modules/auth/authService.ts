import type { PrismaClient } from "@prisma/client";

import { HttpError } from "../../types/httpError.js";
import { getLogger } from "../../infrastructure/logging/logger.js";

export type AuthSession = { accessToken: string; refreshToken: string; expiresIn: number };
export type Membership = { id: string; name: string; role: string; isAdmin: boolean };

type ProviderSession = { access_token: string; refresh_token: string; expires_in: number };

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
      return null;
    }
    if (!response.ok) {
      throw new HttpError("Auth service unavailable", 503);
    }
    let user: { id?: unknown };
    try {
      user = (await response.json()) as { id?: unknown };
    } catch {
      throw new HttpError("Invalid auth service response", 503);
    }
    if (typeof user.id !== "string" || !user.id) {
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
    ): Promise<{ memberships: Membership[]; session?: AuthSession }> {
      let userId = accessToken ? await getUser(accessToken) : null;
      let session: AuthSession | undefined;
      if (!userId && refreshToken) {
        session = await sessionRequest({ refresh_token: refreshToken }, "refresh_token");
        userId = await getUser(session.accessToken);
      }
      if (!userId) {
        throw new HttpError("Session expired", 401);
      }
      const rows = await database.membership.findMany({
        where: { userId },
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
      return session ? { memberships, session } : { memberships };
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
        throw new HttpError("Auth service unavailable", 503);
      }
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
