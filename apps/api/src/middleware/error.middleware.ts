import type { ErrorRequestHandler } from "express";
import { AppError } from "../shared/errors/AppError.js";
import { logError } from "../shared/logger/logger.js";

export const errorMiddleware: ErrorRequestHandler = (
  error,
  _request,
  response,
  _next,
) => {
  const requestId = String(response.locals.requestId ?? "unknown");
  logError(error, requestId);

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    },
  });
};
