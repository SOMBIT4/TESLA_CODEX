import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../shared/errors/AppError.js";

export function validateBody<T>(schema: z.ZodType<T>): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      next(new AppError("VALIDATION_ERROR", "Invalid request data.", 400));
      return;
    }

    request.body = result.data;
    next();
  };
}
