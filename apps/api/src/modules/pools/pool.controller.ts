import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../../shared/errors/AppError.js";
import type { PoolService } from "./pool.service.js";
import type {
  DriverActivePool,
  DriverHistoryPool,
  PoolAcceptance,
  PoolDropOffTransition,
  PoolLifecycleTransition,
} from "./pool.types.js";

export function createPoolController(poolService: PoolService) {
  return {
    active: createHandler(async (request, response) => {
      const activePool = await poolService.getActivePool(
        getDriverUserId(request),
      );

      response.json({
        data: activePool ? toActivePoolResponse(activePool) : null,
      });
    }),

    history: createHandler(async (request, response) => {
      const pools = await poolService.listDriverHistory(
        getDriverUserId(request),
      );

      response.json({
        data: {
          pools: pools.map(toHistoryPoolResponse),
        },
      });
    }),

    acceptRide: createHandler(async (request, response) => {
      const acceptance = await poolService.acceptRide(
        getDriverUserId(request),
        getRideId(request),
      );

      response.status(201).json({ data: toAcceptanceResponse(acceptance) });
    }),

    arrive: createHandler(async (request, response) => {
      const transition = await poolService.arrive(
        getDriverUserId(request),
        getPoolId(request),
      );

      response.json({ data: toLifecycleResponse(transition) });
    }),

    start: createHandler(async (request, response) => {
      const transition = await poolService.start(
        getDriverUserId(request),
        getPoolId(request),
      );

      response.json({ data: toLifecycleResponse(transition) });
    }),

    dropOffRide: createHandler(async (request, response) => {
      const transition = await poolService.dropOffRide(
        getDriverUserId(request),
        getPoolId(request),
        getRideId(request),
      );

      response.json({ data: toDropOffResponse(transition) });
    }),

    complete: createHandler(async (request, response) => {
      const transition = await poolService.complete(
        getDriverUserId(request),
        getPoolId(request),
      );

      response.json({ data: toLifecycleResponse(transition) });
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

function getPoolId(request: Request): string {
  const poolId = request.params.poolId;

  if (typeof poolId !== "string") {
    throw new AppError("VALIDATION_ERROR", "Invalid request data.", 400);
  }

  return poolId;
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

function toActivePoolResponse(activePool: DriverActivePool) {
  return {
    id: activePool.id,
    status: activePool.status,
    pickupZone: activePool.pickupZone,
    vehicle: {
      name: activePool.vehicle.name,
      capacity: activePool.vehicle.capacity,
    },
    occupiedSeats: activePool.occupiedSeats,
    members: activePool.members.map((member) => ({
      rideId: member.rideId,
      passengerName: member.passengerName,
      pickupZone: member.pickupZone,
      destinationZone: member.destinationZone,
      seatsReserved: member.seatsReserved,
      farePoysha: member.farePoysha,
    })),
  };
}

function toHistoryPoolResponse(pool: DriverHistoryPool) {
  return {
    id: pool.id,
    pickupZone: pool.pickupZone,
    vehicle: {
      name: pool.vehicle.name,
      capacity: pool.vehicle.capacity,
    },
    startedAt: pool.startedAt,
    completedAt: pool.completedAt,
    members: pool.members.map((member) => ({
      passengerName: member.passengerName,
      pickupZone: member.pickupZone,
      destinationZone: member.destinationZone,
      seatsReserved: member.seatsReserved,
      farePoysha: member.farePoysha,
      completedAt: member.completedAt,
    })),
  };
}

function toLifecycleResponse(transition: PoolLifecycleTransition) {
  return {
    pool: {
      id: transition.pool.id,
      status: transition.pool.status,
      pickupZone: transition.pool.pickupZone,
      capacity: transition.pool.capacity,
      occupiedSeats: transition.pool.occupiedSeats,
      availableSeats: transition.pool.availableSeats,
      startedAt: transition.pool.startedAt,
      completedAt: transition.pool.completedAt,
    },
    transitionedRideIds: transition.transitionedRideIds,
  };
}

function toDropOffResponse(transition: PoolDropOffTransition) {
  return {
    pool: {
      id: transition.pool.id,
      status: transition.pool.status,
      pickupZone: transition.pool.pickupZone,
      capacity: transition.pool.capacity,
      occupiedSeats: transition.pool.occupiedSeats,
      availableSeats: transition.pool.availableSeats,
      startedAt: transition.pool.startedAt,
      completedAt: transition.pool.completedAt,
    },
    droppedOffRideId: transition.droppedOffRideId,
    completedAt: transition.completedAt,
  };
}

function createHandler(
  handler: (request: Request, response: Response) => Promise<void>,
): RequestHandler {
  return (request, response, next: NextFunction) => {
    handler(request, response).catch(next);
  };
}
