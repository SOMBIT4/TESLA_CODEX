import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../../shared/errors/AppError.js";
import type { CreateRideInput } from "./ride.schema.js";
import type { RideService } from "./ride.service.js";
import type { RideRecord } from "./ride.types.js";

export function createRideController(rideService: RideService) {
  return {
    estimate: createHandler(async (request, response) => {
      const estimatedFarePoysha = rideService.estimateFare(
        request.body as CreateRideInput,
      );

      response.json({
        data: {
          estimatedFarePoysha,
          estimatedFareDisplay: formatPoysha(estimatedFarePoysha),
        },
      });
    }),

    create: createHandler(async (request, response) => {
      const ride = await rideService.createRide(
        getPassengerId(request),
        request.body as CreateRideInput,
      );

      response.status(201).json({ data: toRideResponse(ride) });
    }),

    listMine: createHandler(async (request, response) => {
      const rides = await rideService.listPassengerRides(
        getPassengerId(request),
      );

      response.json({ data: { rides: rides.map(toRideResponse) } });
    }),

    getMine: createHandler(async (request, response) => {
      const ride = await rideService.getPassengerRide(
        getPassengerId(request),
        getRideId(request),
      );

      response.json({ data: toRideResponse(ride) });
    }),

    cancel: createHandler(async (request, response) => {
      const ride = await rideService.cancelPassengerRide(
        getPassengerId(request),
        getRideId(request),
      );

      response.json({ data: toRideResponse(ride) });
    }),
  };
}

function getPassengerId(request: Request): string {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "Authentication required.", 401);
  }

  return request.user.userId;
}

function getRideId(request: Request): string {
  const rideId = request.params.rideId;

  if (typeof rideId !== "string") {
    throw new AppError("VALIDATION_ERROR", "Invalid request data.", 400);
  }

  return rideId;
}

function toRideResponse(ride: RideRecord) {
  return {
    id: ride.id,
    status: ride.status,
    pickupZone: ride.pickupZone,
    destinationZone: ride.destinationZone,
    seatsRequested: ride.seatsRequested,
    estimatedFarePoysha: ride.estimatedFarePoysha,
    membershipFarePoysha: ride.membershipFarePoysha,
    createdAt: ride.createdAt,
    cancelledAt: ride.cancelledAt,
    completedAt: ride.completedAt,
  };
}

function formatPoysha(poysha: number): string {
  const taka = poysha / 100;
  return `৳${Number.isInteger(taka) ? taka : taka.toFixed(2)}`;
}

function createHandler(
  handler: (request: Request, response: Response) => Promise<void>,
): RequestHandler {
  return (request, response, next: NextFunction) => {
    handler(request, response).catch(next);
  };
}
