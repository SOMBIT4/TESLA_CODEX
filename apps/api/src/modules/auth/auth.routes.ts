import { Router } from "express";
import { validateBody } from "../../middleware/validate.middleware.js";
import { requireAuth } from "./auth.middleware.js";
import { createAuthController } from "./auth.controller.js";
import {
  loginSchema,
  profileUpdateSchema,
  registerSchema,
} from "./auth.schema.js";
import type { AuthService } from "./auth.service.js";

export function createAuthRouter(authService: AuthService): Router {
  const router = Router();
  const controller = createAuthController(authService);

  router.post("/register", validateBody(registerSchema), controller.register);
  router.post("/login", validateBody(loginSchema), controller.login);
  router.post("/logout", controller.logout);
  router.get("/me", requireAuth, controller.me);
  router.patch(
    "/me",
    requireAuth,
    validateBody(profileUpdateSchema),
    controller.updateMe,
  );

  return router;
}
