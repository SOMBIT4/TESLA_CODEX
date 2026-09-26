import { describe, expect, it, vi } from "vitest";
import {
  createDriverRepository,
  type DriverQueryClient,
} from "../src/modules/driver/driver.repository.js";

const snapshotRow = {
  driver_id: "driver-1",
  is_online: false,
  updated_at: "2026-09-26T00:00:00.000Z",
  vehicle_id: "vehicle-1",
  vehicle_name: "Bullet",
  vehicle_capacity: 3,
  vehicle_is_active: true,
};

const waitingRideRow = {
  id: "ride-1",
  pickup_zone: "Banani",
  destination_zone: "Mohakhali",
  seats_requested: 1,
  estimated_fare_poysha: 8600,
  created_at: "2026-09-26T00:00:00.000Z",
};

function createQueryClient(): DriverQueryClient & {
  query: ReturnType<typeof vi.fn>;
} {
  const query = vi.fn();
  query.mockImplementation(async (text: string) => ({
    rows: text.includes("ride_requests") ? [waitingRideRow] : [snapshotRow],
  }));

  return {
    query,
  };
}

describe("driver repository", () => {
  it("maps a driver snapshot with the active Bullet vehicle", async () => {
    const client = createQueryClient();
    const repository = createDriverRepository(client);

    await expect(repository.findSnapshot("jashim-user")).resolves.toEqual({
      driverId: "driver-1",
      isOnline: false,
      updatedAt: "2026-09-26T00:00:00.000Z",
      vehicle: {
        id: "vehicle-1",
        name: "Bullet",
        capacity: 3,
        isActive: true,
      },
    });
  });

  it("uses one boolean-cast conditional update for driver availability", async () => {
    const client = createQueryClient();
    const repository = createDriverRepository(client);

    await repository.setOnlineStatusIfAllowed("jashim-user", true);

    expect(client.query).toHaveBeenCalledWith(
      expect.stringMatching(
        /UPDATE drivers AS d[\s\S]*is_online = \$2::boolean[\s\S]*updated_at = NOW\(\)[\s\S]*EXISTS \([\s\S]*is_active = TRUE/,
      ),
      ["jashim-user", true],
    );
  });

  it("returns the requested rides oldest first with a hard limit", async () => {
    const client = createQueryClient();
    const repository = createDriverRepository(client);

    await expect(repository.listRequestedRides()).resolves.toEqual([
      {
        id: "ride-1",
        pickupZone: "Banani",
        destinationZone: "Mohakhali",
        seatsRequested: 1,
        estimatedFarePoysha: 8600,
        createdAt: "2026-09-26T00:00:00.000Z",
      },
    ]);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringMatching(
        /WHERE status = 'REQUESTED'[\s\S]*ORDER BY created_at ASC, id ASC[\s\S]*LIMIT 50/,
      ),
    );
  });
});
