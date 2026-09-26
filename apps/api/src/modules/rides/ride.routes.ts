import { Router } from "express";
import { validateBody } from "../../middleware/validate.middleware.js";
import { requireAuth } from "../auth/auth.middleware.js";
import { requireRole } from "../auth/role.middleware.js";
import { createRideController } from "./ride.controller.js";
import { createRideSchema } from "./ride.schema.js";
import type { RideService } from "./ride.service.js";

export function createRideRouter(rideService: RideService): Router {
  const router = Router();
  const controller = createRideController(rideService);

  router.post("/estimate", validateBody(createRideSchema), controller.estimate);

  router.use(requireAuth, requireRole("PASSENGER"));
  router.post("/", validateBody(createRideSchema), controller.create);
  router.get("/me", controller.listMine);
  router.get("/:rideId", controller.getMine);
  router.post("/:rideId/cancel", controller.cancel);

  return router;
}
