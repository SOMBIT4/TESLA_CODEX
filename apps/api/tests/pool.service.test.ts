import { describe, expect, it } from "vitest";
import type {
  PoolAcceptanceOutcome,
  PoolRepository,
  PoolRideForFare,
} from "../src/modules/pools/pool.repository.js";
import { createPoolService } from "../src/modules/pools/pool.service.js";

const requestedRide: PoolRideForFare = {
  id: "ride-1",
  status: "REQUESTED",
  pickupZone: "Banani",
  destinationZone: "Mohakhali",
  seatsRequested: 1,
};

function acceptedRepository(
  ride: PoolRideForFare = requestedRide,
): PoolRepository & { input?: Parameters<PoolRepository["acceptRide"]>[0] } {
  const repository: PoolRepository & {
    input?: Parameters<PoolRepository["acceptRide"]>[0];
  } = {
    async acceptRide(input, calculatePooledFare) {
      repository.input = input;
      const farePoysha = calculatePooledFare(ride);

      return {
        kind: "accepted",
        acceptance: {
          pool: {
            id: "pool-1",
            status: "MATCHED",
            pickupZone: ride.pickupZone,
            capacity: 3,
            occupiedSeats: ride.seatsRequested,
            availableSeats: 3 - ride.seatsRequested,
          },
          membership: {
            id: "membership-1",
            rideRequestId: ride.id,
            seatsReserved: ride.seatsRequested,
            farePoysha,
            status: "ACTIVE",
          },
        },
      };
    },
  };

  return repository;
}

function outcomeRepository(outcome: PoolAcceptanceOutcome): PoolRepository {
  return {
    async acceptRide() {
      return outcome;
    },
  };
}

describe("pool service", () => {
  it("stores the per-seat pooled fare for Banani to Mohakhali", async () => {
    const repository = acceptedRepository();
    const service = createPoolService(repository);

    await expect(service.acceptRide("jashim-user", "ride-1")).resolves.toEqual({
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
    });
    expect(repository.input).toMatchObject({
      driverUserId: "jashim-user",
      rideId: "ride-1",
    });
    expect(repository.input?.poolId).toEqual(expect.any(String));
    expect(repository.input?.membershipId).toEqual(expect.any(String));
    expect(repository.input?.statusEventId).toEqual(expect.any(String));
  });

  it("stores the per-seat pooled fare for Banani to Gulshan 1", async () => {
    const repository = acceptedRepository({
      ...requestedRide,
      destinationZone: "Gulshan 1",
    });
    const service = createPoolService(repository);

    await expect(
      service.acceptRide("jashim-user", "ride-1"),
    ).resolves.toMatchObject({
      membership: { farePoysha: 5900 },
    });
  });

  it.each([
    [
      { kind: "driver_profile_missing" } satisfies PoolAcceptanceOutcome,
      "DRIVER_PROFILE_NOT_FOUND",
      404,
    ],
    [
      { kind: "driver_offline" } satisfies PoolAcceptanceOutcome,
      "DRIVER_OFFLINE",
      409,
    ],
    [
      { kind: "no_active_vehicle" } satisfies PoolAcceptanceOutcome,
      "NO_ACTIVE_VEHICLE",
      409,
    ],
    [
      { kind: "ride_not_found" } satisfies PoolAcceptanceOutcome,
      "RIDE_NOT_FOUND",
      404,
    ],
    [
      { kind: "ride_not_requested" } satisfies PoolAcceptanceOutcome,
      "RIDE_ALREADY_MATCHED",
      409,
    ],
    [
      { kind: "ride_not_compatible" } satisfies PoolAcceptanceOutcome,
      "RIDE_NOT_COMPATIBLE",
      409,
    ],
    [{ kind: "pool_full" } satisfies PoolAcceptanceOutcome, "POOL_FULL", 409],
  ])("maps %s to its public AppError", async (outcome, code, statusCode) => {
    const service = createPoolService(outcomeRepository(outcome));

    await expect(
      service.acceptRide("jashim-user", "ride-1"),
    ).rejects.toMatchObject({
      code,
      statusCode,
    });
  });
});
