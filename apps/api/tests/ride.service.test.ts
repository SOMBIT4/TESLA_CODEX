import { describe, expect, it } from "vitest";
import type { RideRepository } from "../src/modules/rides/ride.repository.js";
import { createRideService } from "../src/modules/rides/ride.service.js";
import type { RideRecord } from "../src/modules/rides/ride.types.js";

const requestedRide: RideRecord = {
  id: "ride-1",
  passengerId: "nusrat-id",
  pickupZone: "Banani",
  destinationZone: "Mohakhali",
  seatsRequested: 1,
  status: "REQUESTED",
  estimatedFarePoysha: 8600,
  membershipFarePoysha: null,
  createdAt: "2026-09-26T00:00:00.000Z",
  cancelledAt: null,
  completedAt: null,
};

function createRepository(): RideRepository & {
  created?: Parameters<RideRepository["create"]>[0];
  statusEvents: Array<Parameters<RideRepository["cancelRequestedRide"]>[0]>;
} {
  let ride = requestedRide;
  const repository: RideRepository & {
    created?: Parameters<RideRepository["create"]>[0];
    statusEvents: Array<Parameters<RideRepository["cancelRequestedRide"]>[0]>;
  } = {
    statusEvents: [],
    async create(input) {
      repository.created = input;
      ride = {
        ...input,
        status: "REQUESTED",
        membershipFarePoysha: null,
        createdAt: "2026-09-26T00:00:00.000Z",
        cancelledAt: null,
        completedAt: null,
      };
      return ride;
    },
    async findOwnedById(rideId, passengerId) {
      return ride.id === rideId && ride.passengerId === passengerId
        ? ride
        : null;
    },
    async listForPassenger(passengerId) {
      return ride.passengerId === passengerId ? [ride] : [];
    },
    async cancelRequestedRide(input) {
      if (
        ride.id !== input.rideId ||
        ride.passengerId !== input.passengerId ||
        ride.status !== "REQUESTED"
      ) {
        return null;
      }

      repository.statusEvents.push(input);
      ride = {
        ...ride,
        status: "CANCELLED",
        cancelledAt: "2026-09-26T01:00:00.000Z",
      };
      return ride;
    },
  };

  return repository;
}

describe("ride service", () => {
  it("stores the deterministic solo fare when creating a ride", async () => {
    const repository = createRepository();
    const service = createRideService(repository);

    const ride = await service.createRide("nusrat-id", {
      pickupZone: "Banani",
      destinationZone: "Mohakhali",
      seats: 1,
    });

    expect(repository.created).toMatchObject({
      passengerId: "nusrat-id",
      pickupZone: "Banani",
      destinationZone: "Mohakhali",
      seatsRequested: 1,
      estimatedFarePoysha: 8600,
    });
    expect(ride).toMatchObject({
      status: "REQUESTED",
      estimatedFarePoysha: 8600,
    });
  });

  it("cancels a requested ride once and records a status event", async () => {
    const repository = createRepository();
    const service = createRideService(repository);

    const cancelled = await service.cancelPassengerRide("nusrat-id", "ride-1");

    expect(cancelled).toMatchObject({ status: "CANCELLED" });
    expect(repository.statusEvents).toHaveLength(1);
    expect(repository.statusEvents[0]).toMatchObject({
      rideId: "ride-1",
      passengerId: "nusrat-id",
    });

    await expect(
      service.cancelPassengerRide("nusrat-id", "ride-1"),
    ).rejects.toMatchObject({
      code: "INVALID_RIDE_TRANSITION",
      statusCode: 409,
    });
    expect(repository.statusEvents).toHaveLength(1);
  });
});
