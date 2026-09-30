import { randomUUID } from "node:crypto";
import { AppError } from "../../shared/errors/AppError.js";
import { calculateFare } from "../fares/fare-rules.js";
import { canTransitionRide } from "../rides/ride-state-machine.js";
import {
  createPoolRepository,
  type PoolRepository,
} from "./pool.repository.js";
import type {
  DriverActivePool,
  DriverHistoryPool,
  PoolDropOffOutcome,
  PoolDropOffTransition,
  PoolAcceptance,
  PoolLifecycleOutcome,
  PoolLifecycleTransition,
  PoolStatus,
} from "./pool.types.js";

export interface PoolService {
  getActivePool(driverUserId: string): Promise<DriverActivePool | null>;
  listDriverHistory(driverUserId: string): Promise<DriverHistoryPool[]>;
  acceptRide(driverUserId: string, rideId: string): Promise<PoolAcceptance>;
  arrive(
    driverUserId: string,
    poolId: string,
  ): Promise<PoolLifecycleTransition>;
  start(driverUserId: string, poolId: string): Promise<PoolLifecycleTransition>;
  complete(
    driverUserId: string,
    poolId: string,
  ): Promise<PoolLifecycleTransition>;
  dropOffRide(
    driverUserId: string,
    poolId: string,
    rideId: string,
  ): Promise<PoolDropOffTransition>;
}

export function createPoolService(
  repository: PoolRepository = createPoolRepository(),
): PoolService {
  return {
    async getActivePool(driverUserId) {
      const outcome = await repository.getActivePool(driverUserId);

      if (outcome.kind === "active_pool") {
        return outcome.activePool;
      }

      if (outcome.kind === "no_active_pool") {
        return null;
      }

      throw new AppError(
        "DRIVER_PROFILE_NOT_FOUND",
        "Driver profile not found.",
        404,
      );
    },

    async listDriverHistory(driverUserId) {
      const outcome = await repository.listDriverHistory(driverUserId);

      if (outcome.kind === "history") {
        return outcome.pools;
      }

      throw new AppError(
        "DRIVER_PROFILE_NOT_FOUND",
        "Driver profile not found.",
        404,
      );
    },

    async acceptRide(driverUserId, rideId) {
      const outcome = await repository.acceptRide(
        {
          driverUserId,
          rideId,
          poolId: randomUUID(),
          membershipId: randomUUID(),
          statusEventId: randomUUID(),
        },
        (ride, pooled) =>
          calculateFare(
            ride.pickupZone,
            ride.destinationZone,
            ride.seatsRequested,
            pooled,
          ),
      );

      if (outcome.kind === "accepted") {
        return outcome.acceptance;
      }

      throw outcomeError(outcome.kind);
    },

    async arrive(driverUserId, poolId) {
      return transitionPool(
        repository,
        driverUserId,
        poolId,
        "MATCHED",
        "DRIVER_ARRIVED",
      );
    },

    async start(driverUserId, poolId) {
      return transitionPool(
        repository,
        driverUserId,
        poolId,
        "DRIVER_ARRIVED",
        "STARTED",
      );
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
      const outcome = await repository.dropOffRide(
        { driverUserId, poolId, rideId },
        randomUUID,
      );

      if (outcome.kind === "dropped_off") {
        return outcome.dropOff;
      }

      throw dropOffOutcomeError(outcome);
    },
  };
}

async function transitionPool(
  repository: PoolRepository,
  driverUserId: string,
  poolId: string,
  expectedStatus: PoolStatus,
  targetStatus: PoolStatus,
): Promise<PoolLifecycleTransition> {
  if (!canTransitionRide(expectedStatus, targetStatus)) {
    throw new Error("Configured pool lifecycle transition is invalid.");
  }

  const outcome = await repository.transitionPool(
    {
      driverUserId,
      poolId,
      expectedStatus,
      targetStatus,
    },
    randomUUID,
  );

  if (outcome.kind === "transitioned") {
    return outcome.transition;
  }

  throw lifecycleOutcomeError(outcome);
}

function outcomeError(
  kind: Exclude<
    import("./pool.types.js").PoolAcceptanceOutcome["kind"],
    "accepted"
  >,
): AppError {
  switch (kind) {
    case "driver_profile_missing":
      return new AppError(
        "DRIVER_PROFILE_NOT_FOUND",
        "Driver profile not found.",
        404,
      );
    case "driver_offline":
      return new AppError(
        "DRIVER_OFFLINE",
        "Driver must be online to accept rides.",
        409,
      );
    case "no_active_vehicle":
      return new AppError(
        "NO_ACTIVE_VEHICLE",
        "An active vehicle is required to accept rides.",
        409,
      );
    case "ride_not_found":
      return new AppError("RIDE_NOT_FOUND", "Ride not found.", 404);
    case "ride_not_requested":
      return new AppError(
        "RIDE_ALREADY_MATCHED",
        "Only requested rides can be accepted.",
        409,
      );
    case "ride_not_compatible":
      return new AppError(
        "RIDE_NOT_COMPATIBLE",
        "Ride pickup zone is not compatible with the active pool.",
        409,
      );
    case "pool_not_accepting":
      return new AppError(
        "POOL_NOT_ACCEPTING",
        "The active pool is no longer accepting rides.",
        409,
      );
    case "pool_full":
      return new AppError("POOL_FULL", "The pool has no available seats.", 409);
  }
}

function lifecycleOutcomeError(
  outcome: Exclude<PoolLifecycleOutcome, { kind: "transitioned" }>,
): AppError {
  switch (outcome.kind) {
    case "driver_profile_missing":
      return new AppError(
        "DRIVER_PROFILE_NOT_FOUND",
        "Driver profile not found.",
        404,
      );
    case "pool_not_found":
      return new AppError("POOL_NOT_FOUND", "Pool not found.", 404);
    case "invalid_pool_transition":
      return new AppError(
        "INVALID_POOL_TRANSITION",
        "Pool cannot make that transition.",
        409,
      );
    case "pool_ride_state_mismatch":
      return new AppError(
        "POOL_RIDE_STATE_MISMATCH",
        "Pool and ride states are inconsistent.",
        409,
      );
  }
}

function dropOffOutcomeError(
  outcome: Exclude<PoolDropOffOutcome, { kind: "dropped_off" }>,
): AppError {
  switch (outcome.kind) {
    case "driver_profile_missing":
      return new AppError(
        "DRIVER_PROFILE_NOT_FOUND",
        "Driver profile not found.",
        404,
      );
    case "pool_not_found":
      return new AppError("POOL_NOT_FOUND", "Pool not found.", 404);
    case "invalid_pool_transition":
      return new AppError(
        "INVALID_POOL_TRANSITION",
        "Pool must be started before dropping off riders.",
        409,
      );
    case "ride_not_found":
      return new AppError(
        "RIDE_NOT_FOUND",
        "Ride is not an active member of this pool.",
        404,
      );
    case "ride_not_started":
      return new AppError(
        "RIDE_NOT_STARTED",
        "Ride is not ready for drop-off.",
        409,
      );
    case "pool_ride_state_mismatch":
      return new AppError(
        "POOL_RIDE_STATE_MISMATCH",
        "Pool and ride states are inconsistent.",
        409,
      );
  }
}
