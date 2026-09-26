import { Router } from "express";
import { validateBody } from "../../middleware/validate.middleware.js";
import { requireAuth } from "../auth/auth.middleware.js";
import { requireRole } from "../auth/role.middleware.js";
import { createDriverController } from "./driver.controller.js";
import { driverStatusSchema } from "./driver.schema.js";
import type { DriverService } from "./driver.service.js";

export function createDriverRouter(driverService: DriverService): Router {
  const router = Router();
  const controller = createDriverController(driverService);

  router.use(requireAuth, requireRole("DRIVER"));
  router.get("/me", controller.me);
  router.post(
    "/status",
    validateBody(driverStatusSchema),
    controller.updateStatus,
  );
  router.get("/requests", controller.listRequests);

  return router;
}
