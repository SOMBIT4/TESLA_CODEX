import { Router } from "express";
import { createAuthRouter } from "../modules/auth/auth.routes.js";
import {
  createAuthService,
  type AuthService,
} from "../modules/auth/auth.service.js";
import { createRideRouter } from "../modules/rides/ride.routes.js";
import {
  createRideService,
  type RideService,
} from "../modules/rides/ride.service.js";

export function createApiRouter(
  authService: AuthService = createAuthService(),
  rideService: RideService = createRideService(),
): Router {
  const router = Router();

  router.get("/", (_request, response) => {
    response.json({
      data: {
        service: "api",
        version: "0.1.0",
      },
    });
  });

  router.use("/auth", createAuthRouter(authService));
  router.use("/rides", createRideRouter(rideService));

  return router;
}
