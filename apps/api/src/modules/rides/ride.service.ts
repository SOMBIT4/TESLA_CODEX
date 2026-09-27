import { randomUUID } from "node:crypto";
import { calculateFare } from "../fares/fare-rules.js";
import { AppError } from "../../shared/errors/AppError.js";
import {
  createRideRepository,
  type RideRepository,
} from "./ride.repository.js";
import type { CreateRideInput } from "./ride.schema.js";
import { canTransitionRide } from "./ride-state-machine.js";
import type { RideRecord } from "./ride.types.js";

export interface RideService {
  estimateFare(input: CreateRideInput): number;
  createRide(passengerId: string, input: CreateRideInput): Promise<RideRecord>;
  listPassengerRides(passengerId: string): Promise<RideRecord[]>;
  getPassengerRide(passengerId: string, rideId: string): Promise<RideRecord>;
  cancelPassengerRide(passengerId: string, rideId: string): Promise<RideRecord>;
}

export function createRideService(
  repository: RideRepository = createRideRepository(),
): RideService {
  return {
    estimateFare(input) {
      return calculateFare(
        input.pickupZone,
        input.destinationZone,
        input.seats,
        false,
      );
    },

    async createRide(passengerId, input) {
      const estimatedFarePoysha = this.estimateFare(input);

      return repository.create({
        id: randomUUID(),
        passengerId,
        pickupZone: input.pickupZone,
        destinationZone: input.destinationZone,
        seatsRequested: input.seats,
        estimatedFarePoysha,
      });
    },

    async listPassengerRides(passengerId) {
      return repository.listForPassenger(passengerId);
    },

    async getPassengerRide(passengerId, rideId) {
      const ride = await repository.findOwnedById(rideId, passengerId);

      if (!ride) {
        throw rideNotFoundError();
      }

      return ride;
    },

    async cancelPassengerRide(passengerId, rideId) {
      const ride = await repository.findOwnedById(rideId, passengerId);

      if (!ride) {
        throw rideNotFoundError();
      }

      if (!canTransitionRide(ride.status, "CANCELLED")) {
        throw invalidCancellationError();
      }

      const cancelledRide = await repository.cancelRequestedRide({
        rideId,
        passengerId,
        statusEventId: randomUUID(),
      });

      if (!cancelledRide) {
        throw invalidCancellationError();
      }

      return cancelledRide;
    },
  };
}

function rideNotFoundError(): AppError {
  return new AppError("RIDE_NOT_FOUND", "Ride not found.", 404);
}

function invalidCancellationError(): AppError {
  return new AppError(
    "INVALID_RIDE_TRANSITION",
    "Only requested rides can be cancelled.",
    409,
  );
}
