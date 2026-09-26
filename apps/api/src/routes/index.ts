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
import { createDriverRouter } from "../modules/driver/driver.routes.js";
import {
  createDriverService,
  type DriverService,
} from "../modules/driver/driver.service.js";
import { createPoolRouter } from "../modules/pools/pool.routes.js";
import {
  createPoolService,
  type PoolService,
} from "../modules/pools/pool.service.js";

export function createApiRouter(
  authService: AuthService = createAuthService(),
  rideService: RideService = createRideService(),
  driverService: DriverService = createDriverService(),
  poolService: PoolService = createPoolService(),
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
  router.use("/driver", createDriverRouter(driverService));
  router.use("/driver", createPoolRouter(poolService));

  return router;
}
