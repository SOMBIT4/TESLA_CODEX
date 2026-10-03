import { AppError } from "../../shared/errors/AppError.js";
import {
  createDriverRepository,
  type DriverRepository,
} from "./driver.repository.js";
import type { DriverVehicleUpdateInput } from "./driver.schema.js";
import type { DriverSnapshot, WaitingRide } from "./driver.types.js";

export interface DriverService {
  getSnapshot(userId: string): Promise<DriverSnapshot>;
  setOnlineStatus(userId: string, isOnline: boolean): Promise<DriverSnapshot>;
  listWaitingRides(userId: string): Promise<WaitingRide[]>;
  updateVehicleProfile(
    userId: string,
    input: DriverVehicleUpdateInput,
  ): Promise<DriverSnapshot>;
}

export function createDriverService(
  repository: DriverRepository = createDriverRepository(),
): DriverService {
  async function getExistingSnapshot(userId: string): Promise<DriverSnapshot> {
    const snapshot = await repository.findSnapshot(userId);

    if (!snapshot) {
      throw new AppError(
        "DRIVER_PROFILE_NOT_FOUND",
        "Driver profile not found.",
        404,
      );
    }

    return snapshot;
  }

  return {
    getSnapshot: getExistingSnapshot,

    async setOnlineStatus(userId, isOnline) {
      await getExistingSnapshot(userId);
      const updatedSnapshot = await repository.setOnlineStatusIfAllowed(
        userId,
        isOnline,
      );

      if (!updatedSnapshot) {
        throw new AppError(
          "NO_ACTIVE_VEHICLE",
          "An active vehicle is required to go online.",
          409,
        );
      }

      return updatedSnapshot;
    },

    async listWaitingRides(userId) {
      await getExistingSnapshot(userId);
      return repository.listRequestedRides();
    },

    async updateVehicleProfile(userId, input) {
      const outcome = await repository.updateVehicleProfile(userId, input);

      switch (outcome.kind) {
        case "updated":
          return outcome.snapshot;
        case "driver_profile_missing":
          throw new AppError(
            "DRIVER_PROFILE_NOT_FOUND",
            "Driver profile not found.",
            404,
          );
        case "active_vehicle_missing":
          throw new AppError(
            "ACTIVE_VEHICLE_NOT_FOUND",
            "Active vehicle not found.",
            404,
          );
        case "vehicle_profile_locked":
          throw new AppError(
            "VEHICLE_PROFILE_LOCKED",
            "Vehicle details cannot be changed while online or in an active pool.",
            409,
          );
      }
    },
  };
}
