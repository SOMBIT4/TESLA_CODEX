import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { errorMiddleware } from "../src/middleware/error.middleware.js";
import {
  AUTH_COOKIE_NAME,
  signAuthToken,
} from "../src/modules/auth/auth.security.js";
import { requireAuth } from "../src/modules/auth/auth.middleware.js";
import { requireRole } from "../src/modules/auth/role.middleware.js";

function createProtectedApp() {
  const app = express();

  app.get("/protected", requireAuth, (_request, response) => {
    response.json({ data: { ok: true } });
  });
  app.get(
    "/driver-only",
    requireAuth,
    requireRole("DRIVER"),
    (_request, response) => {
      response.json({ data: { ok: true } });
    },
  );
  app.use(errorMiddleware);

  return app;
}

describe("auth middleware", () => {
  it.each([
    ["missing cookie", undefined],
    ["malformed cookie", `${AUTH_COOKIE_NAME}=not-a-token`],
  ])("rejects a %s", async (_label, cookie) => {
    const app = createProtectedApp();
    const response = cookie
      ? await request(app).get("/protected").set("Cookie", cookie)
      : await request(app).get("/protected");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required.",
      },
    });
  });

  it("rejects an expired token", async () => {
    const token = jwt.sign(
      { sub: "user-1", role: "PASSENGER" },
      env.JWT_SECRET,
      { expiresIn: -1 },
    );

    const response = await request(createProtectedApp())
      .get("/protected")
      .set("Cookie", `${AUTH_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects passengers from driver-only routes", async () => {
    const token = signAuthToken({ userId: "user-1", role: "PASSENGER" });

    const response = await request(createProtectedApp())
      .get("/driver-only")
      .set("Cookie", `${AUTH_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "You do not have permission to access this resource.",
      },
    });
  });

  it("allows drivers through driver-only routes", async () => {
    const token = signAuthToken({ userId: "driver-1", role: "DRIVER" });

    const response = await request(createProtectedApp())
      .get("/driver-only")
      .set("Cookie", `${AUTH_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { ok: true } });
  });
});
