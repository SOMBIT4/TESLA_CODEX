import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/AppError.js";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "./auth.security.js";

export const requireAuth: RequestHandler = (request, _response, next) => {
  const token = readCookie(request.headers.cookie, AUTH_COOKIE_NAME);

  if (!token) {
    next(new AppError("UNAUTHENTICATED", "Authentication required.", 401));
    return;
  }

  try {
    request.user = verifyAuthToken(token);
    next();
  } catch {
    next(new AppError("UNAUTHENTICATED", "Authentication required.", 401));
  }
};

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) {
    return null;
  }

  const cookie = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!cookie) {
    return null;
  }

  const value = cookie.slice(name.length + 1);

  try {
    return decodeURIComponent(value) || null;
  } catch {
    return null;
  }
}
