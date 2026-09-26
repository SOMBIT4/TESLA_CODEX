import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/AppError.js";
import type { UserRole } from "./auth.types.js";

export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.user) {
      next(new AppError("UNAUTHENTICATED", "Authentication required.", 401));
      return;
    }

    if (!allowedRoles.includes(request.user.role)) {
      next(
        new AppError(
          "FORBIDDEN",
          "You do not have permission to access this resource.",
          403,
        ),
      );
      return;
    }

    next();
  };
}
