import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import {
  AUTH_COOKIE_NAME,
  signAuthToken,
} from "../src/modules/auth/auth.security.js";
import type { AuthIdentity } from "../src/modules/auth/auth.types.js";
import type { RideRepository } from "../src/modules/rides/ride.repository.js";
import { createRideService } from "../src/modules/rides/ride.service.js";
import type { RideRecord } from "../src/modules/rides/ride.types.js";

const nusrat: AuthIdentity = { userId: "nusrat-id", role: "PASSENGER" };
const rafiq: AuthIdentity = { userId: "rafiq-id", role: "PASSENGER" };
const jashim: AuthIdentity = { userId: "jashim-id", role: "DRIVER" };

function authCookie(identity: AuthIdentity): string {
  return `${AUTH_COOKIE_NAME}=${signAuthToken(identity)}`;
}

function createRideTestContext() {
  const rides = new Map<
    string,
    RideRecord & { phoneNumber: string }
  >();
  const statusEvents: Array<{
    rideId: string;
    passengerId: string;
    statusEventId: string;
  }> = [];

  const repository: RideRepository = {
    async create(input) {
      const ride: RideRecord = {
        ...input,
        status: "REQUESTED",
        createdAt: "2026-09-26T00:00:00.000Z",
        cancelledAt: null,
        completedAt: null,
      };
      const storedRide: RideRecord & { phoneNumber: string } = {
        ...ride,
        phoneNumber: "+8801712345678",
      };
      rides.set(storedRide.id, storedRide);
      return storedRide;
    },
    async findOwnedById(rideId, passengerId) {
      const ride = rides.get(rideId);
      return ride?.passengerId === passengerId ? ride : null;
    },
    async listForPassenger(passengerId) {
      return [...rides.values()].filter(
        (ride) => ride.passengerId === passengerId,
      );
    },
    async cancelRequestedRide(input) {
      const ride = rides.get(input.rideId);

      if (
        !ride ||
        ride.passengerId !== input.passengerId ||
        ride.status !== "REQUESTED"
      ) {
        return null;
      }

      const cancelledRide: RideRecord & { phoneNumber: string } = {
        ...ride,
        status: "CANCELLED",
        cancelledAt: "2026-09-26T01:00:00.000Z",
      };
      rides.set(cancelledRide.id, cancelledRide);
      statusEvents.push({
        rideId: input.rideId,
        passengerId: input.passengerId,
        statusEventId: input.statusEventId,
      });
      return cancelledRide;
    },
  };

  return {
    app: createApp({ rideService: createRideService(repository) }),
    rides,
    statusEvents,
  };
}

const rideInput = {
  pickupZone: "Banani",
  destinationZone: "Mohakhali",
  seats: 1,
};

describe("passenger ride request endpoints", () => {
  it("returns a deterministic solo fare estimate", async () => {
    const { app } = createRideTestContext();

    const response = await request(app)
      .post("/api/rides/estimate")
      .send(rideInput);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        estimatedFarePoysha: 8600,
        estimatedFareDisplay: "৳86",
      },
    });
  });

  it.each([
    { ...rideInput, seats: 0 },
    { ...rideInput, seats: 5 },
    { ...rideInput, pickupZone: "Banani", destinationZone: "Banani" },
  ])("rejects invalid ride input", async (invalidInput) => {
    const { app } = createRideTestContext();

    const response = await request(app)
      .post("/api/rides/estimate")
      .send(invalidInput);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a driver attempting to create a passenger ride", async () => {
    const { app } = createRideTestContext();

    const response = await request(app)
      .post("/api/rides")
      .set("Cookie", authCookie(jashim))
      .send(rideInput);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("creates a requested ride with the solo fare and lists it for its passenger", async () => {
    const { app } = createRideTestContext();

    const created = await request(app)
      .post("/api/rides")
      .set("Cookie", authCookie(nusrat))
      .send(rideInput);

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      status: "REQUESTED",
      pickupZone: "Banani",
      destinationZone: "Mohakhali",
      seatsRequested: 1,
      estimatedFarePoysha: 8600,
      completedAt: null,
    });
    expect(JSON.stringify(created.body)).not.toContain("+8801712345678");
    expect(created.body.data).not.toHaveProperty("phoneNumber");

    const listed = await request(app)
      .get("/api/rides/me")
      .set("Cookie", authCookie(nusrat));

    expect(listed.status).toBe(200);
    expect(listed.body.data.rides).toHaveLength(1);
    expect(listed.body.data.rides[0].id).toBe(created.body.data.id);
    expect(JSON.stringify(listed.body)).not.toContain("+8801712345678");
    expect(listed.body.data.rides[0]).not.toHaveProperty("phoneNumber");
  });

  it("returns 404 when Rafiq tries to view or cancel Nusrat's ride", async () => {
    const { app } = createRideTestContext();
    const created = await request(app)
      .post("/api/rides")
      .set("Cookie", authCookie(nusrat))
      .send(rideInput);
    const rideId = created.body.data.id as string;

    const viewed = await request(app)
      .get(`/api/rides/${rideId}`)
      .set("Cookie", authCookie(rafiq));
    const cancelled = await request(app)
      .post(`/api/rides/${rideId}/cancel`)
      .set("Cookie", authCookie(rafiq));

    expect(viewed.status).toBe(404);
    expect(viewed.body.error.code).toBe("RIDE_NOT_FOUND");
    expect(cancelled.status).toBe(404);
    expect(cancelled.body.error.code).toBe("RIDE_NOT_FOUND");
  });

  it("cancels a requested ride once and records one event", async () => {
    const context = createRideTestContext();
    const created = await request(context.app)
      .post("/api/rides")
      .set("Cookie", authCookie(nusrat))
      .send(rideInput);
    const rideId = created.body.data.id as string;

    const cancelled = await request(context.app)
      .post(`/api/rides/${rideId}/cancel`)
      .set("Cookie", authCookie(nusrat));
    const cancelledAgain = await request(context.app)
      .post(`/api/rides/${rideId}/cancel`)
      .set("Cookie", authCookie(nusrat));

    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("CANCELLED");
    expect(context.statusEvents).toHaveLength(1);
    expect(context.statusEvents[0]).toMatchObject({
      rideId,
      passengerId: nusrat.userId,
    });
    expect(cancelledAgain.status).toBe(409);
    expect(cancelledAgain.body.error.code).toBe("INVALID_RIDE_TRANSITION");
    expect(context.statusEvents).toHaveLength(1);
  });
});
