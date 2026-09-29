import { describe, expect, it, vi } from "vitest";
import {
  createRideRepository,
  type RideQueryClient,
  type RideTransactionRunner,
} from "../src/modules/rides/ride.repository.js";

interface StoredRideRow {
  id: string;
  passenger_id: string;
  pickup_zone: string;
  destination_zone: string;
  seats_requested: number;
  status: string;
  estimated_fare_poysha: number;
  created_at: string;
  cancelled_at: string | null;
  completed_at: string | null;
}

const storedRide: StoredRideRow = {
  id: "ride-1",
  passenger_id: "nusrat-id",
  pickup_zone: "Banani",
  destination_zone: "Mohakhali",
  seats_requested: 1,
  status: "REQUESTED",
  estimated_fare_poysha: 8600,
  created_at: "2026-09-26T00:00:00.000Z",
  cancelled_at: null,
  completed_at: null,
};

function createQueryClient(
  rows = [storedRide],
): RideQueryClient & { query: ReturnType<typeof vi.fn> } {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  };
}

describe("ride repository", () => {
  it("uses a parameterized passenger filter when finding an owned ride", async () => {
    const client = createQueryClient();
    const repository = createRideRepository(client);

    await repository.findOwnedById("ride-1", "nusrat-id");

    expect(client.query).toHaveBeenCalledWith(
      expect.stringMatching(/WHERE id = \$1\s+AND passenger_id = \$2/),
      ["ride-1", "nusrat-id"],
    );
  });

  it("uses a parameterized passenger filter when listing rides", async () => {
    const client = createQueryClient();
    const repository = createRideRepository(client);

    await repository.listForPassenger("nusrat-id");

    expect(client.query).toHaveBeenCalledWith(
      expect.stringMatching(/WHERE passenger_id = \$1/),
      ["nusrat-id"],
    );
  });

  it("maps the ride completion timestamp when listing a completed ride", async () => {
    const completedAt = "2026-09-30T04:30:00.000Z";
    const client = createQueryClient([
      {
        ...storedRide,
        status: "COMPLETED",
        completed_at: completedAt,
      },
    ]);
    const repository = createRideRepository(client);

    const rides = await repository.listForPassenger("nusrat-id");

    expect(rides[0]).toMatchObject({
      status: "COMPLETED",
      completedAt,
    });
  });

  it("creates a requested ride with parameter values", async () => {
    const client = createQueryClient();
    const repository = createRideRepository(client);

    await repository.create({
      id: "ride-1",
      passengerId: "nusrat-id",
      pickupZone: "Banani",
      destinationZone: "Mohakhali",
      seatsRequested: 1,
      estimatedFarePoysha: 8600,
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO ride_requests"),
      ["ride-1", "nusrat-id", "Banani", "Mohakhali", 1, 8600],
    );
    expect(client.query.mock.calls[0]?.[0]).toContain("'REQUESTED'");
  });

  it("cancels only an owned requested ride and records its status event in one transaction", async () => {
    const client = createQueryClient([
      {
        ...storedRide,
        status: "CANCELLED",
        cancelled_at: "2026-09-26T01:00:00.000Z",
      },
    ]);
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            ...storedRide,
            status: "CANCELLED",
            cancelled_at: "2026-09-26T01:00:00.000Z",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const runInTransaction: RideTransactionRunner = vi.fn(async (callback) =>
      callback(client),
    );
    const repository = createRideRepository(client, runInTransaction);

    const ride = await repository.cancelRequestedRide({
      rideId: "ride-1",
      passengerId: "nusrat-id",
      statusEventId: "event-1",
    });

    expect(runInTransaction).toHaveBeenCalledOnce();
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(
        /WHERE id = \$1\s+AND passenger_id = \$2\s+AND status = 'REQUESTED'/,
      ),
      ["ride-1", "nusrat-id"],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO ride_status_events"),
      ["event-1", "ride-1", "nusrat-id", "REQUESTED", "CANCELLED"],
    );
    expect(ride).toMatchObject({ status: "CANCELLED" });
  });
});
