import { describe, expect, it, vi } from "vitest";
import {
  createDriverRepository,
  type DriverQueryClient,
  type DriverTransactionRunner,
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

  it("locks the driver before checking active pools and updating its vehicle", async () => {
    const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
    const transactionClient = {
      query: vi.fn(async (text: string, values?: readonly unknown[]) => {
        calls.push({ text, values });
        if (text.includes("FROM drivers AS d")) {
          return {
            rows: [
              {
                driver_id: "driver-1",
                is_online: false,
                updated_at: "2026-09-26T00:00:00.000Z",
              },
            ],
          };
        }
        if (text.includes("FROM pools")) {
          return { rows: [] };
        }
        if (text.includes("UPDATE vehicles AS v")) {
          return {
            rows: [
              {
                vehicle_id: "vehicle-1",
                vehicle_name: "Bullet Executive",
                vehicle_capacity: 4,
                vehicle_is_active: true,
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };
    let transactionRuns = 0;
    const runInTransaction: DriverTransactionRunner = async (callback) => {
      transactionRuns += 1;
      return callback(transactionClient as unknown as DriverQueryClient);
    };
    const repository = createDriverRepository(
      createQueryClient(),
      runInTransaction,
    );

    await expect(
      repository.updateVehicleProfile("jashim-user", {
        name: "Bullet Executive",
        capacity: 4,
      }),
    ).resolves.toMatchObject({
      kind: "updated",
      snapshot: {
        isOnline: false,
        vehicle: {
          id: "vehicle-1",
          name: "Bullet Executive",
          capacity: 4,
          isActive: true,
        },
      },
    });

    expect(transactionRuns).toBe(1);
    expect(calls).toHaveLength(3);
    expect(calls[0]?.text).toMatch(/FROM drivers AS d[\s\S]*FOR UPDATE/);
    expect(calls[0]?.values).toEqual(["jashim-user"]);
    expect(calls[1]?.text).toMatch(
      /FROM pools[\s\S]*driver_id = \$1[\s\S]*status IN \('MATCHED', 'DRIVER_ARRIVED', 'STARTED'\)/,
    );
    expect(calls[1]?.values).toEqual(["driver-1"]);
    expect(calls[2]?.text).toMatch(
      /UPDATE vehicles AS v[\s\S]*driver_id = \$1[\s\S]*is_active = TRUE[\s\S]*RETURNING/,
    );
    expect(calls[2]?.values).toEqual(["driver-1", "Bullet Executive", 4]);
  });

  it("rejects a locked driver before writing the vehicle", async () => {
    const calls: string[] = [];
    const transactionClient = {
      query: vi.fn(async (text: string) => {
        calls.push(text);
        return {
          rows: [
            {
              driver_id: "driver-1",
              is_online: true,
              updated_at: "2026-09-26T00:00:00.000Z",
            },
          ],
        };
      }),
    };
    const runInTransaction: DriverTransactionRunner = (callback) =>
      callback(transactionClient as unknown as DriverQueryClient);
    const repository = createDriverRepository(
      createQueryClient(),
      runInTransaction,
    );

    await expect(
      repository.updateVehicleProfile("jashim-user", {
        name: "Changed",
        capacity: 4,
      }),
    ).resolves.toEqual({ kind: "vehicle_profile_locked" });
    expect(calls).toHaveLength(1);
  });

  it("returns profile and active-vehicle missing outcomes without unrelated writes", async () => {
    const missingDriverClient = {
      query: vi.fn(async () => ({ rows: [] })),
    } as unknown as DriverQueryClient & { query: ReturnType<typeof vi.fn> };
    const missingDriverRunInTransaction: DriverTransactionRunner = (
      callback,
    ) => callback(missingDriverClient);
    const missingDriverRepository = createDriverRepository(
      createQueryClient(),
      missingDriverRunInTransaction,
    );
    await expect(
      missingDriverRepository.updateVehicleProfile("missing", {
        name: "Bullet",
        capacity: 3,
      }),
    ).resolves.toEqual({ kind: "driver_profile_missing" });

    const transactionClient = {
      query: vi.fn(async (text: string) => {
        if (text.includes("FROM drivers AS d")) {
          return {
            rows: [
              {
                driver_id: "driver-1",
                is_online: false,
                updated_at: "2026-09-26T00:00:00.000Z",
              },
            ],
          };
        }
        return { rows: [] };
      }),
    } as unknown as DriverQueryClient & { query: ReturnType<typeof vi.fn> };
    const runInTransaction: DriverTransactionRunner = (callback) =>
      callback(transactionClient);
    const missingVehicleRepository = createDriverRepository(
      createQueryClient(),
      runInTransaction,
    );
    await expect(
      missingVehicleRepository.updateVehicleProfile("jashim-user", {
        name: "Bullet",
        capacity: 3,
      }),
    ).resolves.toEqual({ kind: "active_vehicle_missing" });
    expect(transactionClient.query).toHaveBeenCalledTimes(3);
  });
});
