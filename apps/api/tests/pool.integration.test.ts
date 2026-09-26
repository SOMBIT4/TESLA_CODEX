import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import {
  AUTH_COOKIE_NAME,
  signAuthToken,
} from "../src/modules/auth/auth.security.js";
import type { AuthIdentity } from "../src/modules/auth/auth.types.js";
import type { PoolService } from "../src/modules/pools/pool.service.js";
import type { PoolAcceptance } from "../src/modules/pools/pool.types.js";
import { AppError } from "../src/shared/errors/AppError.js";

const jashim: AuthIdentity = { userId: "jashim-user", role: "DRIVER" };
const nusrat: AuthIdentity = { userId: "nusrat-user", role: "PASSENGER" };
const driverWithoutProfile: AuthIdentity = {
  userId: "driver-without-profile",
  role: "DRIVER",
};

const firstAcceptance: PoolAcceptance = {
  pool: {
    id: "pool-1",
    status: "MATCHED",
    pickupZone: "Banani",
    capacity: 3,
    occupiedSeats: 1,
    availableSeats: 2,
  },
  membership: {
    id: "membership-1",
    rideRequestId: "ride-1",
    seatsReserved: 1,
    farePoysha: 7100,
    status: "ACTIVE",
  },
};

function authCookie(identity: AuthIdentity): string {
  return `${AUTH_COOKIE_NAME}=${signAuthToken(identity)}`;
}

function createPoolService(): PoolService {
  return {
    async acceptRide(driverUserId, rideId) {
      if (driverUserId !== jashim.userId) {
        throw new AppError(
          "DRIVER_PROFILE_NOT_FOUND",
          "Driver profile not found.",
          404,
        );
      }

      if (rideId === "ride-1") {
        return firstAcceptance;
      }

      if (rideId === "ride-2") {
        return {
          ...firstAcceptance,
          pool: {
            ...firstAcceptance.pool,
            occupiedSeats: 2,
            availableSeats: 1,
          },
          membership: {
            ...firstAcceptance.membership,
            id: "membership-2",
            rideRequestId: "ride-2",
            farePoysha: 5900,
          },
        };
      }

      const failures: Record<string, AppError> = {
        "offline-driver": new AppError(
          "DRIVER_OFFLINE",
          "Driver must be online to accept rides.",
          409,
        ),
        "no-vehicle": new AppError(
          "NO_ACTIVE_VEHICLE",
          "An active vehicle is required to accept rides.",
          409,
        ),
        "missing-ride": new AppError("RIDE_NOT_FOUND", "Ride not found.", 404),
        "already-matched": new AppError(
          "RIDE_ALREADY_MATCHED",
          "Only requested rides can be accepted.",
          409,
        ),
        incompatible: new AppError(
          "RIDE_NOT_COMPATIBLE",
          "Ride pickup zone is not compatible with the active pool.",
          409,
        ),
        full: new AppError(
          "POOL_FULL",
          "The pool has no available seats.",
          409,
        ),
      };

      throw failures[rideId] ?? failures["missing-ride"];
    },
  };
}

function createPoolApp() {
  return createApp({ poolService: createPoolService() });
}

describe("driver pool acceptance endpoint", () => {
  it("returns 401 without a session", async () => {
    const response = await request(createPoolApp()).post(
      "/api/driver/requests/ride-1/accept",
    );

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 403 to a passenger", async () => {
    const response = await request(createPoolApp())
      .post("/api/driver/requests/ride-1/accept")
      .set("Cookie", authCookie(nusrat));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 404 when a driver session has no driver profile", async () => {
    const response = await request(createPoolApp())
      .post("/api/driver/requests/ride-1/accept")
      .set("Cookie", authCookie(driverWithoutProfile));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("DRIVER_PROFILE_NOT_FOUND");
  });

  it("returns the first pool and its public membership summary", async () => {
    const response = await request(createPoolApp())
      .post("/api/driver/requests/ride-1/accept")
      .set("Cookie", authCookie(jashim));

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ data: firstAcceptance });
    expect(response.body.data.membership).not.toHaveProperty("passengerId");
    expect(response.body.data.membership).not.toHaveProperty("name");
    expect(response.body.data.membership).not.toHaveProperty("email");
  });

  it("returns the reused pool with increased occupancy for a compatible ride", async () => {
    const response = await request(createPoolApp())
      .post("/api/driver/requests/ride-2/accept")
      .set("Cookie", authCookie(jashim));

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      pool: { id: "pool-1", occupiedSeats: 2, availableSeats: 1 },
      membership: { rideRequestId: "ride-2", farePoysha: 5900 },
    });
  });

  it.each([
    ["offline-driver", 409, "DRIVER_OFFLINE"],
    ["no-vehicle", 409, "NO_ACTIVE_VEHICLE"],
    ["missing-ride", 404, "RIDE_NOT_FOUND"],
    ["already-matched", 409, "RIDE_ALREADY_MATCHED"],
    ["incompatible", 409, "RIDE_NOT_COMPATIBLE"],
    ["full", 409, "POOL_FULL"],
  ])("maps %s to %i %s", async (rideId, status, code) => {
    const response = await request(createPoolApp())
      .post(`/api/driver/requests/${rideId}/accept`)
      .set("Cookie", authCookie(jashim));

    expect(response.status).toBe(status);
    expect(response.body.error.code).toBe(code);
  });
});
