import { Router, type CookieOptions, type Request, type Response } from "express";
import { z } from "zod";

import type { RuntimeConfig } from "../../types/config.js";
import { HttpError } from "../../types/httpError.js";
import { API_MESSAGE, HTTP_STATUS_MESSAGES } from "../../utils/constants.js";
import type { AuthService, AuthSession } from "./authService.js";

const signInSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1024),
});
const ACCESS_COOKIE = "stuorg_access";
const REFRESH_COOKIE = "stuorg_refresh";

function readCookie(request: Request, name: string): string | undefined {
  const pair = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!pair) {
    return undefined;
  }
  try {
    return decodeURIComponent(pair.slice(name.length + 1));
  } catch {
    return undefined;
  }
}

export function createAuthRouter(
  service: AuthService,
  config: Pick<RuntimeConfig, "environment" | "corsOrigins">,
): Router {
  const router = Router();
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
  function sendError(response: Response, error: unknown) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 401) {
      clearSession(response);
    }
    response
      .status(status)
      .json({ message: HTTP_STATUS_MESSAGES[status] ?? API_MESSAGE.INTERNAL_SERVER_ERROR });
  }

  router.use((request, response, next) => {
    const origin = request.get("Origin");
    if (!origin || !config.corsOrigins.includes(origin)) {
      response.status(403).json({ message: API_MESSAGE.FORBIDDEN });
      return;
    }
    next();
  });

  router.post("/sign-in", async (request, response) => {
    const input = signInSchema.safeParse(request.body);
    if (!input.success) {
      response.status(400).json({ message: API_MESSAGE.INVALID_INPUT });
      return;
    }
    try {
      setSession(response, await service.signIn(input.data.email, input.data.password));
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error);
    }
  });

  router.get("/session", async (request, response) => {
    const access = readCookie(request, ACCESS_COOKIE);
    const refresh = readCookie(request, REFRESH_COOKIE);
    if (!access && !refresh) {
      response.status(401).json({ message: API_MESSAGE.UNAUTHORIZED });
      return;
    }
    try {
      const result = await service.restore(access, refresh);
      if (result.session) {
        setSession(response, result.session);
      }
      response.set("Cache-Control", "no-store").json({ memberships: result.memberships });
    } catch (error) {
      sendError(response, error);
    }
  });

  router.post("/sign-out", async (request, response) => {
    try {
      await service.signOut(
        readCookie(request, ACCESS_COOKIE),
        readCookie(request, REFRESH_COOKIE),
      );
      clearSession(response);
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error);
    }
  });
  return router;
}
