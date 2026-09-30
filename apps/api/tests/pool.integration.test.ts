import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import {
  AUTH_COOKIE_NAME,
  signAuthToken,
} from "../src/modules/auth/auth.security.js";
import type { AuthIdentity } from "../src/modules/auth/auth.types.js";
import type { PoolService } from "../src/modules/pools/pool.service.js";
import type {
  PoolAcceptance,
  PoolDropOffTransition,
  DriverHistoryPool,
  PoolLifecycleTransition,
} from "../src/modules/pools/pool.types.js";
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

const historyPool: DriverHistoryPool = {
  id: "pool-history-newest",
  pickupZone: "Banani",
  vehicle: { name: "Bullet", capacity: 3 },
  startedAt: "2026-09-29T14:00:00.000Z",
  completedAt: "2026-09-29T14:30:00.000Z",
  members: [
    {
      passengerName: "Nusrat",
      pickupZone: "Banani",
      destinationZone: "Mohakhali",
      seatsReserved: 1,
      farePoysha: 7100,
      completedAt: "2026-09-29T14:25:00.000Z",
    },
    {
      passengerName: "Rafiq",
      pickupZone: "Banani",
      destinationZone: "Gulshan 1",
      seatsReserved: 1,
      farePoysha: 5900,
      completedAt: "2026-09-29T14:30:00.000Z",
    },
  ],
};

const olderHistoryPool: DriverHistoryPool = {
  ...historyPool,
  id: "pool-history-older",
  completedAt: "2026-09-28T14:30:00.000Z",
};

function lifecycleTransition(
  status: "DRIVER_ARRIVED" | "STARTED" | "COMPLETED",
): PoolLifecycleTransition {
  return {
    pool: {
      id: "pool-1",
      status,
      pickupZone: "Banani",
      capacity: 3,
      occupiedSeats: 2,
      availableSeats: 1,
      startedAt:
        status === "STARTED" || status === "COMPLETED"
          ? "2026-09-27T10:00:00.000Z"
          : null,
      completedAt: status === "COMPLETED" ? "2026-09-27T10:20:00.000Z" : null,
    },
    transitionedRideIds: ["ride-1", "ride-2"],
  };
}

function dropOffTransition(rideId: string): PoolDropOffTransition {
  return {
    pool: {
      id: "pool-1",
      status: "STARTED",
      pickupZone: "Banani",
      capacity: 3,
      occupiedSeats: 1,
      availableSeats: 2,
      startedAt: "2026-09-29T14:00:00.000Z",
      completedAt: null,
    },
    droppedOffRideId: rideId,
    completedAt: "2026-09-29T14:30:00.000Z",
  };
}

function authCookie(identity: AuthIdentity): string {
  return `${AUTH_COOKIE_NAME}=${signAuthToken(identity)}`;
}

function createPoolService(
  historyPools: DriverHistoryPool[] = [historyPool, olderHistoryPool],
): PoolService {
  return {
    async getActivePool(driverUserId) {
      if (driverUserId !== jashim.userId) {
        throw new AppError(
          "DRIVER_PROFILE_NOT_FOUND",
          "Driver profile not found.",
          404,
        );
      }

      return null;
    },

    async listDriverHistory(driverUserId) {
      if (driverUserId === driverWithoutProfile.userId) {
        throw new AppError(
          "DRIVER_PROFILE_NOT_FOUND",
          "Driver profile not found.",
          404,
        );
      }

      if (driverUserId !== jashim.userId) {
        throw new AppError(
          "DRIVER_PROFILE_NOT_FOUND",
          "Driver profile not found.",
          404,
        );
      }

      return historyPools;
    },

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
        "arrived-pool": new AppError(
          "POOL_NOT_ACCEPTING",
          "The active pool is no longer accepting rides.",
          409,
        ),
      };

      throw failures[rideId] ?? failures["missing-ride"];
    },

    async arrive(driverUserId, poolId) {
      return lifecycleResult(driverUserId, poolId, "DRIVER_ARRIVED");
    },

    async start(driverUserId, poolId) {
      return lifecycleResult(driverUserId, poolId, "STARTED");
    },

    async complete(driverUserId, poolId) {
      void driverUserId;
      void poolId;
      throw new AppError(
        "POOL_COMPLETION_REQUIRES_DROPOFF",
        "Drop off each rider to complete the pool.",
        409,
      );
    },

    async dropOffRide(driverUserId, poolId, rideId) {
      if (driverUserId !== jashim.userId) {
        throw new AppError(
          "DRIVER_PROFILE_NOT_FOUND",
          "Driver profile not found.",
          404,
        );
      }

      if (poolId === "missing" || poolId === "other-driver") {
        throw new AppError("POOL_NOT_FOUND", "Pool not found.", 404);
      }

      if (poolId === "invalid") {
        throw new AppError(
          "INVALID_POOL_TRANSITION",
          "Pool must be started before dropping off riders.",
          409,
        );
      }

      if (rideId === "completed") {
        throw new AppError(
          "RIDE_NOT_STARTED",
          "Ride is not ready for drop-off.",
          409,
        );
      }

      if (rideId === "mismatch") {
        throw new AppError(
          "POOL_RIDE_STATE_MISMATCH",
          "Pool and ride states are inconsistent.",
          409,
        );
      }

      return dropOffTransition(rideId);
    },
  };
}

function lifecycleResult(
  driverUserId: string,
  poolId: string,
  status: "DRIVER_ARRIVED" | "STARTED" | "COMPLETED",
) {
  if (driverUserId !== jashim.userId) {
    throw new AppError(
      "DRIVER_PROFILE_NOT_FOUND",
      "Driver profile not found.",
      404,
    );
  }

  if (poolId === "missing" || poolId === "other-driver") {
    throw new AppError("POOL_NOT_FOUND", "Pool not found.", 404);
  }

  if (poolId === "invalid") {
    throw new AppError(
      "INVALID_POOL_TRANSITION",
      "Pool cannot make that transition.",
      409,
    );
  }

  return lifecycleTransition(status);
}

function createPoolApp(historyPools?: DriverHistoryPool[]) {
  return createApp({ poolService: createPoolService(historyPools) });
}

describe("driver history endpoint", () => {
  it("returns 401 without a session", async () => {
    const response = await request(createPoolApp()).get(
      "/api/driver/history",
    );

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 403 to a passenger", async () => {
    const response = await request(createPoolApp())
      .get("/api/driver/history")
      .set("Cookie", authCookie(nusrat));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 404 when the driver profile is missing", async () => {
    const response = await request(createPoolApp())
      .get("/api/driver/history")
      .set("Cookie", authCookie(driverWithoutProfile));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("DRIVER_PROFILE_NOT_FOUND");
  });

  it("returns an empty pool list when the driver has no completed pools", async () => {
    const response = await request(createPoolApp([]))
      .get("/api/driver/history")
      .set("Cookie", authCookie(jashim));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { pools: [] } });
  });

  it("returns newest-first final fares and passenger-name-only members", async () => {
    const response = await request(createPoolApp())
      .get("/api/driver/history")
      .set("Cookie", authCookie(jashim));

    expect(response.status).toBe(200);
    expect(response.body.data.pools.map((pool: DriverHistoryPool) => pool.id)).toEqual([
      "pool-history-newest",
      "pool-history-older",
    ]);
    expect(response.body.data.pools[0]).toMatchObject({
      vehicle: { name: "Bullet", capacity: 3 },
      members: [
        { passengerName: "Nusrat", farePoysha: 7100 },
        { passengerName: "Rafiq", farePoysha: 5900 },
      ],
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain("passengerId");
    expect(serialized).not.toContain("passengerEmail");
    expect(serialized).not.toContain("rideId");
    expect(serialized).not.toContain("membershipId");
    expect(serialized).not.toContain("@example");
  });

  it("returns the repository's capped history without adding another driver's data", async () => {
    const cappedHistory = Array.from({ length: 50 }, (_, index) => ({
      ...historyPool,
      id: `pool-history-${index}`,
      completedAt: new Date(
        Date.parse("2026-09-30T14:30:00.000Z") - index * 60_000,
      ).toISOString(),
      members: [],
    }));
    const response = await request(createPoolApp(cappedHistory))
      .get("/api/driver/history")
      .set("Cookie", authCookie(jashim));

    expect(response.status).toBe(200);
    expect(response.body.data.pools).toHaveLength(50);
    expect(JSON.stringify(response.body)).not.toContain("other-driver");
  });
});

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
    ["arrived-pool", 409, "POOL_NOT_ACCEPTING"],
  ])("maps %s to %i %s", async (rideId, status, code) => {
    const response = await request(createPoolApp())
      .post(`/api/driver/requests/${rideId}/accept`)
      .set("Cookie", authCookie(jashim));

    expect(response.status).toBe(status);
    expect(response.body.error.code).toBe(code);
  });

  it.each(["arrive", "start"] as const)(
    "returns 401 without a session for %s",
    async (action) => {
      const response = await request(createPoolApp()).post(
        `/api/driver/pools/pool-1/${action}`,
      );

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHENTICATED");
    },
  );

  it.each(["arrive", "start"] as const)(
    "returns 403 to a passenger for %s",
    async (action) => {
      const response = await request(createPoolApp())
        .post(`/api/driver/pools/pool-1/${action}`)
        .set("Cookie", authCookie(nusrat));

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    },
  );

  it("advances a driver pool through arrival and start", async () => {
    for (const [action, status] of [
      ["arrive", "DRIVER_ARRIVED"],
      ["start", "STARTED"],
    ] as const) {
      const response = await request(createPoolApp())
        .post(`/api/driver/pools/pool-1/${action}`)
        .set("Cookie", authCookie(jashim));

      expect(response.status).toBe(200);
      expect(response.body.data.pool.status).toBe(status);
    }
  });

  it("drops off one rider with occupancy and passenger identity safeguards", async () => {
    const response = await request(createPoolApp())
      .post("/api/driver/pools/pool-1/rides/ride-2/drop-off")
      .set("Cookie", authCookie(jashim));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: dropOffTransition("ride-2") });
    expect(JSON.stringify(response.body)).not.toContain("passenger");
    expect(JSON.stringify(response.body)).not.toContain("email");
  });

  it.each([
    ["missing", 404, "POOL_NOT_FOUND"],
    ["other-driver", 404, "POOL_NOT_FOUND"],
    ["invalid", 409, "INVALID_POOL_TRANSITION"],
  ] as const)(
    "maps drop-off pool %s to %i %s",
    async (poolId, status, code) => {
      const response = await request(createPoolApp())
        .post(`/api/driver/pools/${poolId}/rides/ride-1/drop-off`)
        .set("Cookie", authCookie(jashim));

      expect(response.status).toBe(status);
      expect(response.body.error.code).toBe(code);
    },
  );

  it.each([
    ["completed", 409, "RIDE_NOT_STARTED"],
    ["mismatch", 409, "POOL_RIDE_STATE_MISMATCH"],
  ] as const)(
    "maps drop-off ride %s to %i %s",
    async (rideId, status, code) => {
      const response = await request(createPoolApp())
        .post(`/api/driver/pools/pool-1/rides/${rideId}/drop-off`)
        .set("Cookie", authCookie(jashim));

      expect(response.status).toBe(status);
      expect(response.body.error.code).toBe(code);
    },
  );

  it("rejects the deprecated pool-level complete action", async () => {
    const response = await request(createPoolApp())
      .post("/api/driver/pools/pool-1/complete")
      .set("Cookie", authCookie(jashim));

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe(
      "POOL_COMPLETION_REQUIRES_DROPOFF",
    );
  });

  it.each([
    "/api/driver/pools/pool-1/rides/ride-1/drop-off",
    "/api/driver/pools/pool-1/complete",
  ])("returns 401 without a session for %s", async (path) => {
    const response = await request(createPoolApp()).post(path);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it.each([
    "/api/driver/pools/pool-1/rides/ride-1/drop-off",
    "/api/driver/pools/pool-1/complete",
  ])("returns 403 to a passenger for %s", async (path) => {
    const response = await request(createPoolApp())
      .post(path)
      .set("Cookie", authCookie(nusrat));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 404 for a missing or other driver's pool", async () => {
    for (const poolId of ["missing", "other-driver"]) {
      const response = await request(createPoolApp())
        .post(`/api/driver/pools/${poolId}/arrive`)
        .set("Cookie", authCookie(jashim));

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("POOL_NOT_FOUND");
    }
  });

  it.each(["arrive", "start"] as const)(
    "returns a stable error for an invalid %s action",
    async (action) => {
      const response = await request(createPoolApp())
        .post(`/api/driver/pools/invalid/${action}`)
        .set("Cookie", authCookie(jashim));

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("INVALID_POOL_TRANSITION");
    },
  );

  it("keeps lifecycle responses free of passenger identity", async () => {
    const response = await request(createPoolApp())
      .post("/api/driver/pools/pool-1/arrive")
      .set("Cookie", authCookie(jashim));

    expect(response.status).toBe(200);
    expect(response.body.data).not.toHaveProperty("passengerId");
    expect(response.body.data).not.toHaveProperty("name");
    expect(response.body.data).not.toHaveProperty("email");
    expect(response.body.data.pool).not.toHaveProperty("passengerId");
    expect(response.body.data.pool).not.toHaveProperty("name");
    expect(response.body.data.pool).not.toHaveProperty("email");
  });
});
