import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import {
  AUTH_COOKIE_NAME,
  signAuthToken,
} from "../src/modules/auth/auth.security.js";
import type { AuthIdentity } from "../src/modules/auth/auth.types.js";
import type { DriverRepository } from "../src/modules/driver/driver.repository.js";
import { createDriverService } from "../src/modules/driver/driver.service.js";
import type {
  DriverSnapshot,
  WaitingRide,
} from "../src/modules/driver/driver.types.js";

const jashim: AuthIdentity = { userId: "jashim-user", role: "DRIVER" };
const nusrat: AuthIdentity = { userId: "nusrat-user", role: "PASSENGER" };
const noProfileDriver: AuthIdentity = {
  userId: "no-profile-driver",
  role: "DRIVER",
};

function authCookie(identity: AuthIdentity): string {
  return `${AUTH_COOKIE_NAME}=${signAuthToken(identity)}`;
}

function createWaitingRides(): WaitingRide[] {
  return Array.from({ length: 51 }, (_, index) => {
    const order = String(index + 1).padStart(2, "0");

    return {
      id: `ride-${order}`,
      pickupZone: "Banani",
      destinationZone: "Mohakhali",
      seatsRequested: 1,
      estimatedFarePoysha: 8600,
      createdAt: `2026-09-26T00:${order}:00.000Z`,
    };
  });
}

function createDriverTestContext(vehicle = true) {
  let snapshot: DriverSnapshot = {
    driverId: "driver-1",
    isOnline: false,
    updatedAt: "2026-09-26T00:00:00.000Z",
    vehicle: vehicle
      ? {
          id: "vehicle-1",
          name: "Bullet",
          capacity: 3,
          isActive: true,
        }
      : null,
  };
  const allRequestedRides = createWaitingRides();

  const repository: DriverRepository = {
    async findSnapshot(userId) {
      return userId === jashim.userId ? snapshot : null;
    },
    async setOnlineStatusIfAllowed(userId, isOnline) {
      if (userId !== jashim.userId || (isOnline && !snapshot.vehicle)) {
        return null;
      }

      snapshot = {
        ...snapshot,
        isOnline,
        updatedAt: "2026-09-26T01:00:00.000Z",
      };
      return snapshot;
    },
    async listRequestedRides() {
      return allRequestedRides.slice(0, 50);
    },
  };

  return {
    app: createApp({ driverService: createDriverService(repository) }),
    getSnapshot: () => snapshot,
  };
}

describe("driver flow endpoints", () => {
  it.each([
    ["get", "/api/driver/me"],
    ["post", "/api/driver/status"],
    ["get", "/api/driver/requests"],
  ] as const)(
    "returns 401 without a session for %s %s",
    async (method, url) => {
      const { app } = createDriverTestContext();
      const response = await request(app)[method](url);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHENTICATED");
    },
  );

  it.each([
    ["get", "/api/driver/me"],
    ["post", "/api/driver/status"],
    ["get", "/api/driver/requests"],
  ] as const)("returns 403 to passengers for %s %s", async (method, url) => {
    const { app } = createDriverTestContext();
    const response = await request(app)
      [method](url)
      .set("Cookie", authCookie(nusrat));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("loads Bullet on first driver dashboard request and updates availability", async () => {
    const { app } = createDriverTestContext();
    const firstLoad = await request(app)
      .get("/api/driver/me")
      .set("Cookie", authCookie(jashim));
    const updated = await request(app)
      .post("/api/driver/status")
      .set("Cookie", authCookie(jashim))
      .send({ isOnline: true });

    expect(firstLoad.status).toBe(200);
    expect(firstLoad.body).toEqual({
      data: {
        isOnline: false,
        vehicle: {
          id: "vehicle-1",
          name: "Bullet",
          capacity: 3,
          isActive: true,
        },
      },
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ isOnline: true });
  });

  it("validates the availability body", async () => {
    const { app } = createDriverTestContext();
    const response = await request(app)
      .post("/api/driver/status")
      .set("Cookie", authCookie(jashim))
      .send({ isOnline: "yes" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    ["get", "/api/driver/me"],
    ["post", "/api/driver/status"],
    ["get", "/api/driver/requests"],
  ] as const)(
    "returns 404 without a profile for %s %s",
    async (method, url) => {
      const { app } = createDriverTestContext();
      const response = await request(app)
        [method](url)
        .set("Cookie", authCookie(noProfileDriver))
        .send({ isOnline: true });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("DRIVER_PROFILE_NOT_FOUND");
    },
  );

  it("rejects online without a vehicle while allowing offline", async () => {
    const context = createDriverTestContext(false);
    const online = await request(context.app)
      .post("/api/driver/status")
      .set("Cookie", authCookie(jashim))
      .send({ isOnline: true });
    const offline = await request(context.app)
      .post("/api/driver/status")
      .set("Cookie", authCookie(jashim))
      .send({ isOnline: false });

    expect(online.status).toBe(409);
    expect(online.body.error.code).toBe("NO_ACTIVE_VEHICLE");
    expect(context.getSnapshot().isOnline).toBe(false);
    expect(offline.status).toBe(200);
    expect(offline.body.data).toEqual({
      isOnline: false,
      vehicle: null,
    });
  });

  it("returns at most 50 oldest waiting rides without passenger identity", async () => {
    const { app } = createDriverTestContext();
    const response = await request(app)
      .get("/api/driver/requests")
      .set("Cookie", authCookie(jashim));

    expect(response.status).toBe(200);
    expect(response.body.data.rides).toHaveLength(50);
    expect(response.body.data.rides[0].id).toBe("ride-01");
    expect(response.body.data.rides[49].id).toBe("ride-50");
    expect(response.body.data.rides).not.toContainEqual(
      expect.objectContaining({ id: "ride-51" }),
    );

    for (const ride of response.body.data.rides) {
      expect(ride).not.toHaveProperty("passengerId");
      expect(ride).not.toHaveProperty("name");
      expect(ride).not.toHaveProperty("email");
    }
  });
});
