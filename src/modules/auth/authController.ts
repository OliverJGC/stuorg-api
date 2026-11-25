import type { CookieOptions, Request, RequestHandler, Response } from "express";

import { getLogger } from "../../infrastructure/logging/logger.js";
import type { AuthSession } from "./types.js";
import type { RuntimeConfig } from "../../types/config.js";
import { HttpError } from "../../types/httpError.js";
import { API_MESSAGE } from "../../utils/constants.js";
import { readCookie } from "../../utils/cookies.js";
import { getHttpErrorMessage } from "../../utils/errorHelpers.js";
import { signInSchema } from "./authSchema.js";
import type { AuthService } from "./authService.js";

const ACCESS_COOKIE = "stuorg_access";
const REFRESH_COOKIE = "stuorg_refresh";

type AuthController = {
  signInController: RequestHandler;
  restoreSessionController: RequestHandler;
  signOutController: RequestHandler;
};

export function createAuthController(
  service: AuthService,
  config: Pick<RuntimeConfig, "environment">,
): AuthController {
  const options: CookieOptions = {
    httpOnly: true,
    secure: config.environment === "production",
    sameSite: "lax",
    path: "/auth",
  };

  function setSession(response: Response, session: AuthSession) {
    response.cookie(ACCESS_COOKIE, session.accessToken, {
      ...options,
      maxAge: session.expiresIn * 1000,
    });
    response.cookie(REFRESH_COOKIE, session.refreshToken, {
      ...options,
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });
  }

  function clearSession(response: Response) {
    response.clearCookie(ACCESS_COOKIE, options);
    response.clearCookie(REFRESH_COOKIE, options);
  }

  async function signInController(request: Request, response: Response) {
    const input = signInSchema.safeParse(request.body);

    if (!input.success) {
      getLogger().warn(
        { operation: "signInController", status: 400 },
        "[authController] Request validation failed",
      );
      response.status(400).json({ message: API_MESSAGE.INVALID_INPUT });
      return;
    }

    try {
      const session = await service.signIn(input.data.email, input.data.password);
      setSession(response, session);
      getLogger().info(
        { operation: "signInController", status: 200 },
        "[authController] Returning sign-in response",
      );
      response.json({ ok: true });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;

      if (status === 401) {
        clearSession(response);
      }

      getLogger().error(
        { operation: "signInController", status },
        "[authController] Authentication request failed",
      );
      response.status(status).json({
        message: getHttpErrorMessage(status),
      });
    }
  }

  async function restoreSessionController(request: Request, response: Response) {
    const access = readCookie(request, ACCESS_COOKIE);
    const refresh = readCookie(request, REFRESH_COOKIE);

    if (!access && !refresh) {
      getLogger().warn(
        { operation: "restoreSessionController", status: 401 },
        "[authController] Session cookies missing",
      );
      response.status(401).json({ message: API_MESSAGE.UNAUTHORIZED });
      return;
    }

    try {
      const result = await service.restore(access, refresh);

      if (result.refreshedSession) {
        setSession(response, result.refreshedSession);
      }

      getLogger().info(
        { operation: "restoreSessionController", status: 200 },
        "[authController] Returning session response",
      );
      response.set("Cache-Control", "no-store").json({
        user: result.user,
        memberships: result.memberships,
      });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;

      if (status === 401) {
        clearSession(response);
      }

      getLogger().error(
        { operation: "restoreSessionController", status },
        "[authController] Authentication request failed",
      );
      response.status(status).json({
        message: getHttpErrorMessage(status),
      });
    }
  }

  async function signOutController(request: Request, response: Response) {
    try {
      await service.signOut(
        readCookie(request, ACCESS_COOKIE),
        readCookie(request, REFRESH_COOKIE),
      );
      clearSession(response);
      getLogger().info(
        { operation: "signOutController", status: 200 },
        "[authController] Returning sign-out response",
      );
      response.json({ ok: true });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;

      if (status === 401) {
        clearSession(response);
      }

      getLogger().error(
        { operation: "signOutController", status },
        "[authController] Authentication request failed",
      );
      response.status(status).json({
        message: getHttpErrorMessage(status),
      });
    }
  }

  return { signInController, restoreSessionController, signOutController };
}
