import { Router } from "express";
import { createAuthRouter } from "../modules/auth/auth.routes.js";
import {
  createAuthService,
  type AuthService,
} from "../modules/auth/auth.service.js";

export function createApiRouter(
  authService: AuthService = createAuthService(),
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

  return router;
}
