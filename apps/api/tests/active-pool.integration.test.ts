import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import {
  AUTH_COOKIE_NAME,
  signAuthToken,
} from "../src/modules/auth/auth.security.js";
import type { AuthIdentity } from "../src/modules/auth/auth.types.js";
import type { PoolService } from "../src/modules/pools/pool.service.js";

const jashim: AuthIdentity = { userId: "jashim-user", role: "DRIVER" };
const nusrat: AuthIdentity = { userId: "nusrat-user", role: "PASSENGER" };
const anotherDriver: AuthIdentity = {
  userId: "another-driver-user",
  role: "DRIVER",
};

const activePool = {
  id: "pool-1",
  status: "MATCHED",
  pickupZone: "Banani",
  vehicle: {
    name: "Bullet",
    capacity: 3,
  },
  occupiedSeats: 2,
  members: [
    {
      rideId: "ride-1",
      passengerName: "Nusrat",
      pickupZone: "Banani",
      destinationZone: "Mohakhali",
      seatsReserved: 1,
      farePoysha: 7100,
      passengerId: "nusrat-user",
      email: "nusrat@example.com",
      phoneNumber: "+8801712345678",
    },
    {
      rideId: "ride-2",
      passengerName: "Rafiq",
      pickupZone: "Banani",
      destinationZone: "Gulshan 1",
      seatsReserved: 1,
      farePoysha: 5900,
      passengerId: "rafiq-user",
      email: "rafiq@example.com",
      phoneNumber: "+8801812345678",
    },
  ],
};

type ActivePool = typeof activePool;

function authCookie(identity: AuthIdentity): string {
  return `${AUTH_COOKIE_NAME}=${signAuthToken(identity)}`;
}

function createActivePoolApp(
  getActivePool: (driverUserId: string) => Promise<ActivePool | null>,
) {
  const poolService = {
    acceptRide: async () => {
      throw new Error("Not used by active-pool tests.");
    },
    arrive: async () => {
      throw new Error("Not used by active-pool tests.");
    },
    start: async () => {
      throw new Error("Not used by active-pool tests.");
    },
    complete: async () => {
      throw new Error("Not used by active-pool tests.");
    },
    getActivePool,
  } as unknown as PoolService;

  return createApp({ poolService });
}

describe("driver active-pool endpoint", () => {
  it("returns 401 without a session", async () => {
    const response = await request(
      createActivePoolApp(async () => activePool),
    ).get("/api/driver/pools/active");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 403 to a passenger", async () => {
    const response = await request(createActivePoolApp(async () => activePool))
      .get("/api/driver/pools/active")
      .set("Cookie", authCookie(nusrat));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("returns a null data envelope when the driver has no active pool", async () => {
    const response = await request(createActivePoolApp(async () => null))
      .get("/api/driver/pools/active")
      .set("Cookie", authCookie(jashim));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: null });
  });

  it("returns the active pool's operational vehicle, seats, and members", async () => {
    const getActivePool = vi.fn(async (driverUserId: string) =>
      driverUserId === jashim.userId ? activePool : null,
    );
    const response = await request(createActivePoolApp(getActivePool))
      .get("/api/driver/pools/active")
      .set("Cookie", authCookie(jashim));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        id: "pool-1",
        status: "MATCHED",
        pickupZone: "Banani",
        vehicle: { name: "Bullet", capacity: 3 },
        occupiedSeats: 2,
        members: [
          {
            rideId: "ride-1",
            passengerName: "Nusrat",
            pickupZone: "Banani",
            destinationZone: "Mohakhali",
            seatsReserved: 1,
            farePoysha: 7100,
          },
          {
            rideId: "ride-2",
            passengerName: "Rafiq",
            pickupZone: "Banani",
            destinationZone: "Gulshan 1",
            seatsReserved: 1,
            farePoysha: 5900,
          },
        ],
      },
    });
  });

  it("returns null instead of another driver's active pool", async () => {
    const response = await request(
      createActivePoolApp(async (driverUserId) =>
        driverUserId === jashim.userId ? activePool : null,
      ),
    )
      .get("/api/driver/pools/active")
      .set("Cookie", authCookie(anotherDriver));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: null });
  });

  it("does not expose a member's email or passenger ID", async () => {
    const response = await request(createActivePoolApp(async () => activePool))
      .get("/api/driver/pools/active")
      .set("Cookie", authCookie(jashim));

    expect(response.status).toBe(200);
    for (const member of response.body.data.members) {
      expect(member).not.toHaveProperty("email");
      expect(member).not.toHaveProperty("passengerId");
      expect(member).not.toHaveProperty("phoneNumber");
    }
    expect(JSON.stringify(response.body)).not.toContain("+8801712345678");
    expect(JSON.stringify(response.body)).not.toContain("+8801812345678");
  });
});
