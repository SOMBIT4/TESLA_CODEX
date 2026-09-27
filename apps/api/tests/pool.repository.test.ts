import { describe, expect, it, vi } from "vitest";
import {
  createPoolRepository,
  type PoolQueryClient,
  type PoolTransactionRunner,
} from "../src/modules/pools/pool.repository.js";
import type { AcceptRideInput } from "../src/modules/pools/pool.types.js";

const acceptanceInput: AcceptRideInput = {
  driverUserId: "jashim-user",
  rideId: "ride-1",
  poolId: "pool-1",
  membershipId: "membership-1",
  statusEventId: "event-1",
};

const onlineDriver = {
  driver_id: "driver-1",
  is_online: true,
  vehicle_id: "vehicle-1",
  vehicle_capacity: 3,
};

const requestedRide = {
  id: "ride-1",
  status: "REQUESTED",
  pickup_zone: "Banani",
  destination_zone: "Mohakhali",
  seats_requested: 1,
};

const activePool = {
  id: "pool-1",
  status: "MATCHED",
  pickup_zone: "Banani",
  capacity_snapshot: 3,
};

function createQueryClient(
  responses: Array<{ rows: unknown[] }>,
): PoolQueryClient & { query: ReturnType<typeof vi.fn> } {
  const query = vi.fn();

  for (const response of responses) {
    query.mockResolvedValueOnce(response);
  }

  return { query };
}

function createRepository(responses: Array<{ rows: unknown[] }>) {
  const client = createQueryClient(responses);
  const runInTransaction: PoolTransactionRunner = vi.fn(async (callback) =>
    callback(client),
  );

  return {
    client,
    runInTransaction,
    repository: createPoolRepository(client, runInTransaction),
  };
}

describe("pool repository", () => {
  it("creates a first pool, stores a pooled fare, and records the matched event in one transaction", async () => {
    const context = createRepository([
      { rows: [onlineDriver] },
      { rows: [] },
      { rows: [requestedRide] },
      { rows: [activePool] },
      { rows: [{ occupied_seats: 0 }] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
    ]);
    let fareRide: unknown;

    const outcome = await context.repository.acceptRide(
      acceptanceInput,
      (ride) => {
        fareRide = ride;
        return 7345;
      },
    );

    expect(outcome).toEqual({
      kind: "accepted",
      acceptance: {
        pool: {
          id: "pool-1",
          status: "MATCHED",
          pickupZone: "Banani",
          capacity: 3,
          occupiedSeats: 1,
          availableSeats: 2,
        },
        membership: {
          id: "membership-1",
          rideRequestId: "ride-1",
          seatsReserved: 1,
          farePoysha: 7345,
          status: "ACTIVE",
        },
      },
    });
    expect(fareRide).toEqual({
      id: "ride-1",
      status: "REQUESTED",
      pickupZone: "Banani",
      destinationZone: "Mohakhali",
      seatsRequested: 1,
    });
    expect(context.runInTransaction).toHaveBeenCalledOnce();
    expect(context.client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(
        /FROM drivers AS d[\s\S]*WHERE d.user_id = \$1[\s\S]*FOR UPDATE/,
      ),
      ["jashim-user"],
    );
    expect(context.client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(
        /FROM pools[\s\S]*WHERE driver_id = \$1[\s\S]*FOR UPDATE/,
      ),
      ["driver-1"],
    );
    expect(context.client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringMatching(
        /FROM ride_requests[\s\S]*WHERE id = \$1[\s\S]*FOR UPDATE/,
      ),
      ["ride-1"],
    );
    expect(context.client.query).toHaveBeenNthCalledWith(
      5,
      expect.stringMatching(
        /FROM pool_memberships[\s\S]*WHERE pool_id = \$1[\s\S]*status = 'ACTIVE'/,
      ),
      ["pool-1"],
    );
    expect(context.client.query).toHaveBeenNthCalledWith(
      6,
      expect.stringContaining("INSERT INTO pool_memberships"),
      ["membership-1", "pool-1", "ride-1", 1, 7345],
    );
    expect(context.client.query).toHaveBeenNthCalledWith(
      7,
      expect.stringMatching(
        /UPDATE ride_requests[\s\S]*status = 'MATCHED'[\s\S]*WHERE id = \$1/,
      ),
      ["ride-1"],
    );
    expect(context.client.query).toHaveBeenNthCalledWith(
      8,
      expect.stringContaining("INSERT INTO ride_status_events"),
      ["event-1", "ride-1", "pool-1", "jashim-user", "REQUESTED", "MATCHED"],
    );
  });

  it("reuses a matching pickup pool and returns its new occupancy", async () => {
    const context = createRepository([
      { rows: [onlineDriver] },
      { rows: [activePool] },
      { rows: [requestedRide] },
      { rows: [{ occupied_seats: 1 }] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
    ]);

    await expect(
      context.repository.acceptRide(acceptanceInput, () => 7100),
    ).resolves.toMatchObject({
      kind: "accepted",
      acceptance: {
        pool: { id: "pool-1", occupiedSeats: 2, availableSeats: 1 },
      },
    });
    expect(context.client.query.mock.calls).toHaveLength(7);
    expect(
      context.client.query.mock.calls.some(([text]) =>
        String(text).includes("INSERT INTO pools"),
      ),
    ).toBe(false);
  });

  it.each([
    ["missing driver profile", [{ rows: [] }], "driver_profile_missing"],
    [
      "offline driver",
      [{ rows: [{ ...onlineDriver, is_online: false }] }],
      "driver_offline",
    ],
    [
      "driver without an active vehicle",
      [
        {
          rows: [{ ...onlineDriver, vehicle_id: null, vehicle_capacity: null }],
        },
      ],
      "no_active_vehicle",
    ],
    [
      "missing ride",
      [{ rows: [onlineDriver] }, { rows: [] }, { rows: [] }],
      "ride_not_found",
    ],
    [
      "already matched ride",
      [
        { rows: [onlineDriver] },
        { rows: [] },
        { rows: [{ ...requestedRide, status: "MATCHED" }] },
      ],
      "ride_not_requested",
    ],
    [
      "incompatible active pool",
      [
        { rows: [onlineDriver] },
        { rows: [{ ...activePool, pickup_zone: "Gulshan 1" }] },
        { rows: [requestedRide] },
      ],
      "ride_not_compatible",
    ],
    [
      "full compatible pool",
      [
        { rows: [onlineDriver] },
        { rows: [activePool] },
        { rows: [requestedRide] },
        { rows: [{ occupied_seats: 3 }] },
      ],
      "pool_full",
    ],
  ])("returns %s", async (_label, responses, kind) => {
    const context = createRepository(responses);

    await expect(
      context.repository.acceptRide(acceptanceInput, () => 7100),
    ).resolves.toEqual({ kind });
  });

  it.each(["DRIVER_ARRIVED", "STARTED"] as const)(
    "rejects a ride when the active pool is %s without writing",
    async (status) => {
      const context = createRepository([
        { rows: [onlineDriver] },
        { rows: [{ ...activePool, status }] },
      ]);

      await expect(
        context.repository.acceptRide(acceptanceInput, () => 7100),
      ).resolves.toEqual({ kind: "pool_not_accepting" });
      expect(context.client.query).toHaveBeenCalledTimes(2);
      expect(
        context.client.query.mock.calls.some(([text]) =>
          /^\s*(INSERT|UPDATE)\b/.test(String(text)),
        ),
      ).toBe(false);
    },
  );

  it("creates a new matched pool after the previous pool has completed", async () => {
    const context = createRepository([
      { rows: [onlineDriver] },
      { rows: [] },
      { rows: [requestedRide] },
      { rows: [activePool] },
      { rows: [{ occupied_seats: 0 }] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
    ]);

    await expect(
      context.repository.acceptRide(acceptanceInput, () => 7100),
    ).resolves.toMatchObject({
      kind: "accepted",
      acceptance: { pool: { id: "pool-1", status: "MATCHED" } },
    });
    expect(context.client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(
        /status IN \('MATCHED', 'DRIVER_ARRIVED', 'STARTED'\)/,
      ),
      ["driver-1"],
    );
    expect(String(context.client.query.mock.calls[1]?.[0])).not.toContain(
      "COMPLETED",
    );
    expect(
      context.client.query.mock.calls.some(([text]) =>
        String(text).includes("INSERT INTO pools"),
      ),
    ).toBe(true);
  });

  it("transitions an owned pool and every active ride in one transaction", async () => {
    const context = createRepository([
      { rows: [{ driver_id: "driver-1" }] },
      {
        rows: [
          {
            ...activePool,
            started_at: null,
            completed_at: null,
          },
        ],
      },
      {
        rows: [
          {
            ride_request_id: "ride-1",
            status: "MATCHED",
            seats_reserved: 1,
          },
          {
            ride_request_id: "ride-2",
            status: "MATCHED",
            seats_reserved: 2,
          },
        ],
      },
      {
        rows: [
          {
            ...activePool,
            status: "DRIVER_ARRIVED",
            started_at: null,
            completed_at: null,
          },
        ],
      },
      { rows: [{ id: "ride-1" }] },
      { rows: [] },
      { rows: [{ id: "ride-2" }] },
      { rows: [] },
    ]);

    await expect(
      context.repository.transitionPool(
        {
          driverUserId: "jashim-user",
          poolId: "pool-1",
          expectedStatus: "MATCHED",
          targetStatus: "DRIVER_ARRIVED",
        },
        () => "event-1",
      ),
    ).resolves.toEqual({
      kind: "transitioned",
      transition: {
        pool: {
          id: "pool-1",
          status: "DRIVER_ARRIVED",
          pickupZone: "Banani",
          capacity: 3,
          occupiedSeats: 3,
          availableSeats: 0,
          startedAt: null,
          completedAt: null,
        },
        transitionedRideIds: ["ride-1", "ride-2"],
      },
    });
    expect(context.runInTransaction).toHaveBeenCalledOnce();
    expect(context.client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/FROM drivers[\s\S]*FOR UPDATE/),
      ["jashim-user"],
    );
    expect(context.client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/FROM pools[\s\S]*FOR UPDATE/),
      ["pool-1", "driver-1"],
    );
    expect(context.client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringMatching(
        /FROM pool_memberships AS m[\s\S]*JOIN ride_requests AS r[\s\S]*FOR UPDATE OF m, r/,
      ),
      ["pool-1"],
    );
    expect(context.client.query).toHaveBeenNthCalledWith(
      5,
      expect.stringMatching(
        /UPDATE ride_requests[\s\S]*status = \$2[\s\S]*WHERE id = \$1[\s\S]*status = \$3/,
      ),
      ["ride-1", "DRIVER_ARRIVED", "MATCHED"],
    );
  });

  it("rejects a lifecycle transition before writes when member ride state differs", async () => {
    const context = createRepository([
      { rows: [{ driver_id: "driver-1" }] },
      { rows: [{ ...activePool, started_at: null, completed_at: null }] },
      {
        rows: [
          {
            ride_request_id: "ride-1",
            status: "DRIVER_ARRIVED",
            seats_reserved: 1,
          },
        ],
      },
    ]);

    await expect(
      context.repository.transitionPool(
        {
          driverUserId: "jashim-user",
          poolId: "pool-1",
          expectedStatus: "MATCHED",
          targetStatus: "DRIVER_ARRIVED",
        },
        () => "event-1",
      ),
    ).resolves.toEqual({ kind: "pool_ride_state_mismatch" });
    expect(context.client.query).toHaveBeenCalledTimes(3);
  });
});
