import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../../shared/errors/AppError.js";
import type {
  DriverStatusInput,
  DriverVehicleUpdateInput,
} from "./driver.schema.js";
import type { DriverService } from "./driver.service.js";
import type { DriverSnapshot, WaitingRide } from "./driver.types.js";

export function createDriverController(driverService: DriverService) {
  return {
    me: createHandler(async (request, response) => {
      const snapshot = await driverService.getSnapshot(
        getDriverUserId(request),
      );
      response.json({ data: toSnapshotResponse(snapshot) });
    }),

    updateStatus: createHandler(async (request, response) => {
      const input = request.body as DriverStatusInput;
      const snapshot = await driverService.setOnlineStatus(
        getDriverUserId(request),
        input.isOnline,
      );

      response.json({ data: toSnapshotResponse(snapshot) });
    }),

    updateVehicle: createHandler(async (request, response) => {
      const snapshot = await driverService.updateVehicleProfile(
        getDriverUserId(request),
        request.body as DriverVehicleUpdateInput,
      );

      response.json({ data: toSnapshotResponse(snapshot) });
    }),

    listRequests: createHandler(async (request, response) => {
      const rides = await driverService.listWaitingRides(
        getDriverUserId(request),
      );

      response.json({ data: { rides: rides.map(toWaitingRideResponse) } });
    }),
  };
}

function getDriverUserId(request: Request): string {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "Authentication required.", 401);
  }

  return request.user.userId;
}

function toSnapshotResponse(snapshot: DriverSnapshot) {
  return {
    isOnline: snapshot.isOnline,
    vehicle: snapshot.vehicle,
  };
}

function toWaitingRideResponse(ride: WaitingRide) {
  return {
    id: ride.id,
    pickupZone: ride.pickupZone,
    destinationZone: ride.destinationZone,
    seatsRequested: ride.seatsRequested,
    estimatedFarePoysha: ride.estimatedFarePoysha,
    createdAt: ride.createdAt,
  };
}

function createHandler(
  handler: (request: Request, response: Response) => Promise<void>,
): RequestHandler {
  return (request, response, next: NextFunction) => {
    handler(request, response).catch(next);
  };
}
