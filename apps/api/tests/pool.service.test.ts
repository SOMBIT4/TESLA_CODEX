import { describe, expect, it } from "vitest";
import type {
  DriverHistoryOutcome,
  PoolDropOffOutcome,
  PoolAcceptanceOutcome,
  PoolLifecycleOutcome,
  PoolRepository,
  PoolRideForFare,
} from "../src/modules/pools/pool.repository.js";
import { createPoolService } from "../src/modules/pools/pool.service.js";
import type {
  PoolDropOffTransition,
  PoolLifecycleTransition,
} from "../src/modules/pools/pool.types.js";

const requestedRide: PoolRideForFare = {
  id: "ride-1",
  status: "REQUESTED",
  pickupZone: "Banani",
  destinationZone: "Mohakhali",
  seatsRequested: 1,
};

function acceptedRepository(
  ride: PoolRideForFare = requestedRide,
  pooled = false,
): PoolRepository & { input?: Parameters<PoolRepository["acceptRide"]>[0] } {
  const repository: PoolRepository & {
    input?: Parameters<PoolRepository["acceptRide"]>[0];
  } = {
    async getActivePool() {
      return { kind: "no_active_pool" };
    },
    async listDriverHistory() {
      return { kind: "history", pools: [] };
    },
    async acceptRide(input, calculateFare) {
      repository.input = input;
      const farePoysha = calculateFare(ride, pooled);

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
    async transitionPool() {
      return { kind: "pool_not_found" };
    },
    async dropOffRide() {
      return { kind: "pool_not_found" };
    },
  };

  return repository;
}

function outcomeRepository(outcome: PoolAcceptanceOutcome): PoolRepository {
  return {
    async getActivePool() {
      return { kind: "no_active_pool" };
    },
    async listDriverHistory() {
      return { kind: "history", pools: [] };
    },
    async acceptRide() {
      return outcome;
    },
    async transitionPool() {
      return { kind: "pool_not_found" };
    },
    async dropOffRide() {
      return { kind: "pool_not_found" };
    },
  };
}

const droppedOffTransition: PoolDropOffTransition = {
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
  droppedOffRideId: "ride-2",
  completedAt: "2026-09-29T14:30:00.000Z",
};

const completedHistoryPool = {
  id: "pool-history-1",
  pickupZone: "Banani" as const,
  vehicle: { name: "Bullet", capacity: 3 },
  startedAt: "2026-09-29T14:00:00.000Z",
  completedAt: "2026-09-29T14:30:00.000Z",
  members: [
    {
      passengerName: "Nusrat",
      pickupZone: "Banani" as const,
      destinationZone: "Mohakhali" as const,
      seatsReserved: 1,
      farePoysha: 7100,
      completedAt: "2026-09-29T14:25:00.000Z",
    },
  ],
};

function dropOffOutcomeRepository(
  outcome: PoolDropOffOutcome,
): PoolRepository & {
  dropOffInput?: Parameters<PoolRepository["dropOffRide"]>[0];
  generatedEventIds: string[];
} {
  const repository: PoolRepository & {
    dropOffInput?: Parameters<PoolRepository["dropOffRide"]>[0];
    generatedEventIds: string[];
  } = {
    generatedEventIds: [],
    async getActivePool() {
      return { kind: "no_active_pool" };
    },
    async listDriverHistory() {
      return { kind: "history", pools: [] };
    },
    async acceptRide() {
      return { kind: "ride_not_found" };
    },
    async transitionPool() {
      return { kind: "pool_not_found" };
    },
    async dropOffRide(input, createStatusEventId) {
      repository.dropOffInput = input;
      repository.generatedEventIds.push(createStatusEventId());
      return outcome;
    },
  };

  return repository;
}

const arrivedPool: PoolLifecycleTransition = {
  pool: {
    id: "pool-1",
    status: "DRIVER_ARRIVED",
    pickupZone: "Banani",
    capacity: 3,
    occupiedSeats: 2,
    availableSeats: 1,
    startedAt: null,
    completedAt: null,
  },
  transitionedRideIds: ["ride-1", "ride-2"],
};

function lifecycleOutcomeRepository(
  outcome: PoolLifecycleOutcome = {
    kind: "transitioned",
    transition: arrivedPool,
  },
): PoolRepository & {
  transitionInput?: Parameters<PoolRepository["transitionPool"]>[0];
  generatedEventIds: string[];
} {
  const repository: PoolRepository & {
    transitionInput?: Parameters<PoolRepository["transitionPool"]>[0];
    generatedEventIds: string[];
  } = {
    generatedEventIds: [],
    async getActivePool() {
      return { kind: "no_active_pool" };
    },
    async listDriverHistory() {
      return { kind: "history", pools: [] };
    },
    async acceptRide() {
      return { kind: "ride_not_found" };
    },
    async transitionPool(input, createStatusEventId) {
      repository.transitionInput = input;
      repository.generatedEventIds.push(createStatusEventId());
      return outcome;
    },
    async dropOffRide() {
      return { kind: "pool_not_found" };
    },
  };

  return repository;
}

function historyOutcomeRepository(
  outcome: DriverHistoryOutcome,
): PoolRepository {
  return {
    async getActivePool() {
      return { kind: "no_active_pool" };
    },
    async listDriverHistory() {
      return outcome;
    },
    async acceptRide() {
      return { kind: "ride_not_found" };
    },
    async transitionPool() {
      return { kind: "pool_not_found" };
    },
    async dropOffRide() {
      return { kind: "pool_not_found" };
    },
  };
}

describe("pool service", () => {
  it("returns completed driver history with final member fares", async () => {
    const service = createPoolService(
      historyOutcomeRepository({
        kind: "history",
        pools: [completedHistoryPool],
      }),
    );

    await expect(service.listDriverHistory("jashim-user")).resolves.toEqual([
      completedHistoryPool,
    ]);
  });

  it("maps a missing driver profile while reading history", async () => {
    const service = createPoolService(
      historyOutcomeRepository({ kind: "driver_profile_missing" }),
    );

    await expect(
      service.listDriverHistory("missing-driver"),
    ).rejects.toMatchObject({
      code: "DRIVER_PROFILE_NOT_FOUND",
      statusCode: 404,
    });
  });

  it("calculates the solo fare for the first Banani to Mohakhali member", async () => {
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
        farePoysha: 8600,
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

  it("calculates the pooled fare for a later Banani to Gulshan 1 member", async () => {
    const repository = acceptedRepository({
      ...requestedRide,
      destinationZone: "Gulshan 1",
    }, true);
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
    [
      { kind: "pool_not_accepting" } satisfies PoolAcceptanceOutcome,
      "POOL_NOT_ACCEPTING",
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

  it("maps arrival to the matching lifecycle transition and creates event IDs", async () => {
    const repository = lifecycleOutcomeRepository();
    const service = createPoolService(repository);

    await expect(service.arrive("jashim-user", "pool-1")).resolves.toEqual(
      arrivedPool,
    );
    expect(repository.transitionInput).toEqual({
      driverUserId: "jashim-user",
      poolId: "pool-1",
      expectedStatus: "MATCHED",
      targetStatus: "DRIVER_ARRIVED",
    });
    expect(repository.generatedEventIds).toEqual([expect.any(String)]);
  });

  it.each([["start", "DRIVER_ARRIVED", "STARTED"]] as const)(
    "maps %s to %s -> %s",
    async (method, expectedStatus, targetStatus) => {
      const repository = lifecycleOutcomeRepository();
      const service = createPoolService(repository);

      await service[method]("jashim-user", "pool-1");

      expect(repository.transitionInput).toMatchObject({
        expectedStatus,
        targetStatus,
      });
    },
  );

  it("maps a drop-off to the repository and creates one event ID", async () => {
    const repository = dropOffOutcomeRepository({
      kind: "dropped_off",
      dropOff: droppedOffTransition,
    });
    const service = createPoolService(repository);

    await expect(
      service.dropOffRide("jashim-user", "pool-1", "ride-2"),
    ).resolves.toEqual(droppedOffTransition);
    expect(repository.dropOffInput).toEqual({
      driverUserId: "jashim-user",
      poolId: "pool-1",
      rideId: "ride-2",
    });
    expect(repository.generatedEventIds).toEqual([expect.any(String)]);
  });

  it.each([
    [
      { kind: "driver_profile_missing" } satisfies PoolDropOffOutcome,
      "DRIVER_PROFILE_NOT_FOUND",
      404,
    ],
    [
      { kind: "pool_not_found" } satisfies PoolDropOffOutcome,
      "POOL_NOT_FOUND",
      404,
    ],
    [
      { kind: "invalid_pool_transition" } satisfies PoolDropOffOutcome,
      "INVALID_POOL_TRANSITION",
      409,
    ],
    [
      { kind: "ride_not_found" } satisfies PoolDropOffOutcome,
      "RIDE_NOT_FOUND",
      404,
    ],
    [
      { kind: "ride_not_started" } satisfies PoolDropOffOutcome,
      "RIDE_NOT_STARTED",
      409,
    ],
    [
      { kind: "pool_ride_state_mismatch" } satisfies PoolDropOffOutcome,
      "POOL_RIDE_STATE_MISMATCH",
      409,
    ],
  ] as const)(
    "maps drop-off %s to its public AppError",
    async (outcome, code, statusCode) => {
      const service = createPoolService(dropOffOutcomeRepository(outcome));

      await expect(
        service.dropOffRide("jashim-user", "pool-1", "ride-2"),
      ).rejects.toMatchObject({ code, statusCode });
    },
  );

  it("rejects the deprecated pool-level completion without calling the repository", async () => {
    const repository = lifecycleOutcomeRepository();
    const service = createPoolService(repository);

    await expect(
      service.complete("jashim-user", "pool-1"),
    ).rejects.toMatchObject({
      code: "POOL_COMPLETION_REQUIRES_DROPOFF",
      statusCode: 409,
    });
    expect(repository.transitionInput).toBeUndefined();
    expect(repository.generatedEventIds).toEqual([]);
  });

  it.each([
    [
      { kind: "driver_profile_missing" } satisfies PoolLifecycleOutcome,
      "DRIVER_PROFILE_NOT_FOUND",
      404,
    ],
    [
      { kind: "pool_not_found" } satisfies PoolLifecycleOutcome,
      "POOL_NOT_FOUND",
      404,
    ],
    [
      { kind: "invalid_pool_transition" } satisfies PoolLifecycleOutcome,
      "INVALID_POOL_TRANSITION",
      409,
    ],
    [
      { kind: "pool_ride_state_mismatch" } satisfies PoolLifecycleOutcome,
      "POOL_RIDE_STATE_MISMATCH",
      409,
    ],
  ])(
    "maps lifecycle %s to its public AppError",
    async (outcome, code, statusCode) => {
      const service = createPoolService(lifecycleOutcomeRepository(outcome));

      await expect(
        service.arrive("jashim-user", "pool-1"),
      ).rejects.toMatchObject({
        code,
        statusCode,
      });
    },
  );
});
