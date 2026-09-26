import cors from "cors";
import express, { type Express } from "express";
import { env } from "./config/env.js";
import { checkDatabaseHealth } from "./db/health.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";
import { createApiRouter } from "./routes/index.js";
import type { AuthService } from "./modules/auth/auth.service.js";
import { createAuthService } from "./modules/auth/auth.service.js";
import type { RideService } from "./modules/rides/ride.service.js";
import { createRideService } from "./modules/rides/ride.service.js";
import type { DriverService } from "./modules/driver/driver.service.js";
import { createDriverService } from "./modules/driver/driver.service.js";
import { AppError } from "./shared/errors/AppError.js";
import { logRequest } from "./shared/logger/logger.js";

export interface AppDependencies {
  authService?: AuthService;
  rideService?: RideService;
  driverService?: DriverService;
}

export function createApp(dependencies: AppDependencies = {}): Express {
  const app = express();
  const authService = dependencies.authService ?? createAuthService();
  const rideService = dependencies.rideService ?? createRideService();
  const driverService = dependencies.driverService ?? createDriverService();

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

  app.get("/health/db", async (_request, response, next) => {
    try {
      await checkDatabaseHealth();
      response.json({
        data: {
          status: "ok",
          service: "database",
        },
      });
    } catch {
      next(
        new AppError("DATABASE_UNAVAILABLE", "Database is unavailable.", 503),
      );
    }
  });

  app.use("/api", createApiRouter(authService, rideService, driverService));
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
