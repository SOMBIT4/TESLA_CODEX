import type { RequestHandler } from "express";
import { AppError } from "../shared/errors/AppError.js";

export const notFoundMiddleware: RequestHandler = (
  request,
  _response,
  next,
) => {
  next(
    new AppError(
      "NOT_FOUND",
      `Route not found: ${request.method} ${request.path}`,
      404,
    ),
  );
};
