import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../../shared/errors/AppError.js";
import type { PoolService } from "./pool.service.js";
import type { PoolAcceptance } from "./pool.types.js";

export function createPoolController(poolService: PoolService) {
  return {
    acceptRide: createHandler(async (request, response) => {
      const acceptance = await poolService.acceptRide(
        getDriverUserId(request),
        getRideId(request),
      );

      response.status(201).json({ data: toAcceptanceResponse(acceptance) });
    }),
  };
}

function getDriverUserId(request: Request): string {
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

function toAcceptanceResponse(acceptance: PoolAcceptance) {
  return {
    pool: {
      id: acceptance.pool.id,
      status: acceptance.pool.status,
      pickupZone: acceptance.pool.pickupZone,
      capacity: acceptance.pool.capacity,
      occupiedSeats: acceptance.pool.occupiedSeats,
      availableSeats: acceptance.pool.availableSeats,
    },
    membership: {
      id: acceptance.membership.id,
      rideRequestId: acceptance.membership.rideRequestId,
      seatsReserved: acceptance.membership.seatsReserved,
      farePoysha: acceptance.membership.farePoysha,
      status: acceptance.membership.status,
    },
  };
}

function createHandler(
  handler: (request: Request, response: Response) => Promise<void>,
): RequestHandler {
  return (request, response, next: NextFunction) => {
    handler(request, response).catch(next);
  };
}
