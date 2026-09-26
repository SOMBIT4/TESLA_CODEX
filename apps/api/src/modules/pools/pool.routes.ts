import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { requireRole } from "../auth/role.middleware.js";
import { createPoolController } from "./pool.controller.js";
import type { PoolService } from "./pool.service.js";

export function createPoolRouter(poolService: PoolService): Router {
  const router = Router();
  const controller = createPoolController(poolService);

  router.use(requireAuth, requireRole("DRIVER"));
  router.post("/requests/:rideId/accept", controller.acceptRide);

  return router;
}
