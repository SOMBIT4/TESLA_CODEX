import cors from "cors";
import express, { type Express } from "express";
import { env } from "./config/env.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";
import { apiRouter } from "./routes/index.js";
import { logRequest } from "./shared/logger/logger.js";

export function createApp(): Express {
  const app = express();

  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));

  app.use((request, response, next) => {
    response.on("finish", () => {
      logRequest({
        method: request.method,
        path: request.path,
        requestId: String(response.locals.requestId ?? "unknown"),
        statusCode: response.statusCode,
      });
    });
    next();
  });

  app.get("/health", (_request, response) => {
    response.json({
      data: {
        status: "ok",
        service: "api",
      },
    });
  });

  app.use("/api", apiRouter);
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
