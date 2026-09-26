import { describe, expect, it } from "vitest";
import type { DriverRepository } from "../src/modules/driver/driver.repository.js";
import { driverStatusSchema } from "../src/modules/driver/driver.schema.js";
import { createDriverService } from "../src/modules/driver/driver.service.js";
import type {
  DriverSnapshot,
  WaitingRide,
} from "../src/modules/driver/driver.types.js";

const bulletSnapshot: DriverSnapshot = {
  driverId: "driver-1",
  isOnline: false,
  updatedAt: "2026-09-26T00:00:00.000Z",
  vehicle: {
    id: "vehicle-1",
    name: "Bullet",
    capacity: 3,
    isActive: true,
  },
};

const waitingRides: WaitingRide[] = [
  {
    id: "ride-1",
    pickupZone: "Banani",
    destinationZone: "Mohakhali",
    seatsRequested: 1,
    estimatedFarePoysha: 8600,
    createdAt: "2026-09-26T00:00:00.000Z",
  },
];

function createRepository(initialSnapshot: DriverSnapshot | null) {
  let snapshot = initialSnapshot;

  const repository: DriverRepository = {
    async findSnapshot(userId) {
      return userId === "jashim-user" ? snapshot : null;
    },
    async setOnlineStatusIfAllowed(userId, isOnline) {
      if (userId !== "jashim-user" || !snapshot) {
        return null;
      }

      if (isOnline && !snapshot.vehicle) {
        return null;
      }

      snapshot = {
        ...snapshot,
        isOnline,
        updatedAt: "2026-09-26T01:00:00.000Z",
      };
      return snapshot;
    },
    async listRequestedRides() {
      return waitingRides;
    },
  };

  return { repository, getSnapshot: () => snapshot };
}

describe("driver service", () => {
  it("accepts only a boolean availability status", () => {
    expect(driverStatusSchema.safeParse({ isOnline: true }).success).toBe(true);
    expect(driverStatusSchema.safeParse({ isOnline: "true" }).success).toBe(
      false,
    );
    expect(driverStatusSchema.safeParse({}).success).toBe(false);
  });

  it("loads the current driver snapshot with Bullet", async () => {
    const context = createRepository(bulletSnapshot);
    const service = createDriverService(context.repository);

    await expect(service.getSnapshot("jashim-user")).resolves.toEqual(
      bulletSnapshot,
    );
  });

  it("rejects a driver role without a driver profile", async () => {
    const context = createRepository(null);
    const service = createDriverService(context.repository);

    await expect(service.getSnapshot("missing-driver")).rejects.toMatchObject({
      code: "DRIVER_PROFILE_NOT_FOUND",
      statusCode: 404,
    });
  });

  it("keeps a no-vehicle driver offline when an online transition is rejected", async () => {
    const context = createRepository({
      ...bulletSnapshot,
      vehicle: null,
    });
    const service = createDriverService(context.repository);

    await expect(
      service.setOnlineStatus("jashim-user", true),
    ).rejects.toMatchObject({
      code: "NO_ACTIVE_VEHICLE",
      statusCode: 409,
    });
    expect(context.getSnapshot()?.isOnline).toBe(false);

    await expect(
      service.setOnlineStatus("jashim-user", false),
    ).resolves.toMatchObject({ isOnline: false, vehicle: null });
  });
});
