import { randomUUID } from "node:crypto";
import { AppError } from "../../shared/errors/AppError.js";
import { calculateFare } from "../fares/fare-rules.js";
import {
  createPoolRepository,
  type PoolRepository,
} from "./pool.repository.js";
import type { PoolAcceptance } from "./pool.types.js";

export interface PoolService {
  acceptRide(driverUserId: string, rideId: string): Promise<PoolAcceptance>;
}

export function createPoolService(
  repository: PoolRepository = createPoolRepository(),
): PoolService {
  return {
    async acceptRide(driverUserId, rideId) {
      const outcome = await repository.acceptRide(
        {
          driverUserId,
          rideId,
          poolId: randomUUID(),
          membershipId: randomUUID(),
          statusEventId: randomUUID(),
        },
        (ride) =>
          calculateFare(
            ride.pickupZone,
            ride.destinationZone,
            ride.seatsRequested,
            true,
          ),
      );

      if (outcome.kind === "accepted") {
        return outcome.acceptance;
      }

      throw outcomeError(outcome.kind);
    },
  };
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
    case "pool_full":
      return new AppError("POOL_FULL", "The pool has no available seats.", 409);
  }
}
