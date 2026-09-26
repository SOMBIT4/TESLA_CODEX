import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../../shared/errors/AppError.js";
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from "./auth.security.js";
import type { AuthService } from "./auth.service.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";

export function createAuthController(authService: AuthService) {
  return {
    register: createHandler(async (request, response) => {
      const session = await authService.register(request.body as RegisterInput);
      setAuthCookie(response, session.token);
      response.status(201).json({ data: { user: session.user } });
    }),

    login: createHandler(async (request, response) => {
      const session = await authService.login(request.body as LoginInput);
      setAuthCookie(response, session.token);
      response.json({ data: { user: session.user } });
    }),

    logout: createHandler(async (_request, response) => {
      response.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions());
      response.json({ data: { loggedOut: true } });
    }),

    me: createHandler(async (request, response) => {
      if (!request.user) {
        throw new AppError("UNAUTHENTICATED", "Authentication required.", 401);
      }

      const user = await authService.getCurrentUser(request.user.userId);
      response.json({ data: { user } });
    }),
  };
}

function setAuthCookie(response: Response, token: string): void {
  response.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
}

function createHandler(
  handler: (request: Request, response: Response) => Promise<void>,
): RequestHandler {
  return (request, response, next: NextFunction) => {
    handler(request, response).catch(next);
  };
}
