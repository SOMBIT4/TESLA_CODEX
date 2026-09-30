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
  it("returns completed pools grouped with final member fares and no passenger identity fields", async () => {
    const context = createRepository([
      { rows: [{ driver_id: "driver-1" }] },
      {
        rows: [
          {
            pool_id: "pool-newest",
            pickup_zone: "Banani",
            vehicle_name: "Bullet",
            vehicle_capacity: 3,
            started_at: "2026-09-30T09:00:00.000Z",
            completed_at: "2026-09-30T10:00:00.000Z",
            ride_request_id: "ride-nusrat",
            passenger_name: "Nusrat",
            member_pickup_zone: "Banani",
            member_destination_zone: "Mohakhali",
            seats_reserved: 1,
            fare_poysha: 7100,
            ride_completed_at: "2026-09-30T09:55:00.000Z",
          },
          {
            pool_id: "pool-newest",
            pickup_zone: "Banani",
            vehicle_name: "Bullet",
            vehicle_capacity: 3,
            started_at: "2026-09-30T09:00:00.000Z",
            completed_at: "2026-09-30T10:00:00.000Z",
            ride_request_id: "ride-rafiq",
            passenger_name: "Rafiq",
            member_pickup_zone: "Banani",
            member_destination_zone: "Gulshan 1",
            seats_reserved: 1,
            fare_poysha: 5900,
            ride_completed_at: "2026-09-30T10:00:00.000Z",
          },
          {
            pool_id: "pool-older",
            pickup_zone: "Dhanmondi",
            vehicle_name: "Bullet",
            vehicle_capacity: 3,
            started_at: "2026-09-29T09:00:00.000Z",
            completed_at: "2026-09-29T10:00:00.000Z",
            ride_request_id: "ride-old",
            passenger_name: "Jashim",
            member_pickup_zone: "Dhanmondi",
            member_destination_zone: "Mirpur",
            seats_reserved: 2,
            fare_poysha: 14800,
            ride_completed_at: "2026-09-29T10:00:00.000Z",
          },
        ],
      },
    ]);

    await expect(
      context.repository.listDriverHistory("jashim-user"),
    ).resolves.toEqual({
      kind: "history",
      pools: [
        {
          id: "pool-newest",
          pickupZone: "Banani",
          vehicle: { name: "Bullet", capacity: 3 },
          startedAt: "2026-09-30T09:00:00.000Z",
          completedAt: "2026-09-30T10:00:00.000Z",
          members: [
            {
              passengerName: "Nusrat",
              pickupZone: "Banani",
              destinationZone: "Mohakhali",
              seatsReserved: 1,
              farePoysha: 7100,
              completedAt: "2026-09-30T09:55:00.000Z",
            },
            {
              passengerName: "Rafiq",
              pickupZone: "Banani",
              destinationZone: "Gulshan 1",
              seatsReserved: 1,
              farePoysha: 5900,
              completedAt: "2026-09-30T10:00:00.000Z",
            },
          ],
        },
        {
          id: "pool-older",
          pickupZone: "Dhanmondi",
          vehicle: { name: "Bullet", capacity: 3 },
          startedAt: "2026-09-29T09:00:00.000Z",
          completedAt: "2026-09-29T10:00:00.000Z",
          members: [
            {
              passengerName: "Jashim",
              pickupZone: "Dhanmondi",
              destinationZone: "Mirpur",
              seatsReserved: 2,
              farePoysha: 14800,
              completedAt: "2026-09-29T10:00:00.000Z",
            },
          ],
        },
      ],
    });
    expect(context.client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/FROM drivers[\s\S]*WHERE user_id = \$1/),
      ["jashim-user"],
    );
    expect(context.client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(
        /WITH completed_pools[\s\S]*LIMIT 50[\s\S]*completed_at DESC[\s\S]*id DESC[\s\S]*joined_at ASC/,
      ),
      ["driver-1"],
    );
    const poolQuery = context.client.query.mock.calls[1]?.[0] as string;
    const selectedFields = poolQuery.slice(
      poolQuery.indexOf("SELECT cp.pool_id"),
      poolQuery.indexOf("FROM completed_pools"),
    );
    expect(selectedFields).not.toMatch(/\b(passenger|u|r|m)\.(id|email)\b/);
  });

  it("reports a missing driver profile without running the history query", async () => {
    const context = createRepository([{ rows: [] }]);

    await expect(
      context.repository.listDriverHistory("missing-driver"),
    ).resolves.toEqual({ kind: "driver_profile_missing" });
    expect(context.client.query).toHaveBeenCalledOnce();
  });

  it("returns an owned active pool without selecting passenger email or ID", async () => {
    const context = createRepository([
      { rows: [{ driver_id: "driver-1" }] },
      {
        rows: [
          {
            pool_id: "pool-1",
            pool_status: "MATCHED",
            pickup_zone: "Banani",
            vehicle_name: "Bullet",
            vehicle_capacity: 3,
            ride_request_id: "ride-1",
            passenger_name: "Nusrat",
            member_pickup_zone: "Banani",
            member_destination_zone: "Mohakhali",
            seats_reserved: 1,
            fare_poysha: 7100,
            membership_status: "ACTIVE",
            ride_status: "MATCHED",
          },
          {
            pool_id: "pool-1",
            pool_status: "MATCHED",
            pickup_zone: "Banani",
            vehicle_name: "Bullet",
            vehicle_capacity: 3,
            ride_request_id: "ride-2",
            passenger_name: "Rafiq",
            member_pickup_zone: "Banani",
            member_destination_zone: "Gulshan 1",
            seats_reserved: 1,
            fare_poysha: 5900,
            membership_status: "ACTIVE",
            ride_status: "MATCHED",
          },
        ],
      },
    ]);

    await expect(
      context.repository.getActivePool("jashim-user"),
    ).resolves.toEqual({
      kind: "active_pool",
      activePool: {
        id: "pool-1",
        status: "MATCHED",
        pickupZone: "Banani",
        vehicle: { name: "Bullet", capacity: 3 },
        occupiedSeats: 2,
        members: [
          {
            rideId: "ride-1",
            passengerName: "Nusrat",
            pickupZone: "Banani",
            destinationZone: "Mohakhali",
            seatsReserved: 1,
            farePoysha: 7100,
          },
          {
            rideId: "ride-2",
            passengerName: "Rafiq",
            pickupZone: "Banani",
            destinationZone: "Gulshan 1",
            seatsReserved: 1,
            farePoysha: 5900,
          },
        ],
      },
    });
    expect(context.runInTransaction).not.toHaveBeenCalled();
    expect(context.client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/FROM drivers[\s\S]*WHERE user_id = \$1/),
      ["jashim-user"],
    );
    expect(context.client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(
        /FROM pools AS p[\s\S]*WHERE p.driver_id = \$1[\s\S]*p.status IN \('MATCHED', 'DRIVER_ARRIVED', 'STARTED'\)/,
      ),
      ["driver-1"],
    );
    const poolQuery = context.client.query.mock.calls[1]?.[0] as string;
    const selectedFields = poolQuery.slice(
      0,
      poolQuery.indexOf("FROM pools AS p"),
    );
    expect(selectedFields).not.toMatch(/\bu\.(email|id)\b/);
  });

  it("omits completed members from active-pool occupancy and member details", async () => {
    const context = createRepository([
      { rows: [{ driver_id: "driver-1" }] },
      {
        rows: [
          {
            pool_id: "pool-1",
            pool_status: "STARTED",
            pickup_zone: "Banani",
            vehicle_name: "Bullet",
            vehicle_capacity: 3,
            ride_request_id: "ride-started",
            passenger_name: "Nusrat",
            member_pickup_zone: "Banani",
            member_destination_zone: "Mohakhali",
            seats_reserved: 1,
            fare_poysha: 7100,
            membership_status: "ACTIVE",
            ride_status: "STARTED",
          },
          {
            pool_id: "pool-1",
            pool_status: "STARTED",
            pickup_zone: "Banani",
            vehicle_name: "Bullet",
            vehicle_capacity: 3,
            ride_request_id: "ride-completed",
            passenger_name: "Rafiq",
            member_pickup_zone: "Banani",
            member_destination_zone: "Gulshan 1",
            seats_reserved: 1,
            fare_poysha: 5900,
            membership_status: "ACTIVE",
            ride_status: "COMPLETED",
          },
        ],
      },
    ]);

    await expect(
      context.repository.getActivePool("jashim-user"),
    ).resolves.toEqual({
      kind: "active_pool",
      activePool: {
        id: "pool-1",
        status: "STARTED",
        pickupZone: "Banani",
        vehicle: { name: "Bullet", capacity: 3 },
        occupiedSeats: 1,
        members: [
          {
            rideId: "ride-started",
            passengerName: "Nusrat",
            pickupZone: "Banani",
            destinationZone: "Mohakhali",
            seatsReserved: 1,
            farePoysha: 7100,
          },
        ],
      },
    });
  });

  it("returns no active pool when the authenticated driver has none", async () => {
    const context = createRepository([
      { rows: [{ driver_id: "driver-2" }] },
      { rows: [] },
    ]);

    await expect(
      context.repository.getActivePool("other-driver"),
    ).resolves.toEqual({
      kind: "no_active_pool",
    });
    expect(context.client.query).toHaveBeenLastCalledWith(
      expect.stringMatching(/WHERE p.driver_id = \$1/),
      ["driver-2"],
    );
  });

  it("drops one started member, preserves the pool, and reports remaining occupancy", async () => {
    const context = createRepository([
      { rows: [{ driver_id: "driver-1" }] },
      {
        rows: [
          {
            id: "pool-1",
            status: "STARTED",
            pickup_zone: "Banani",
            capacity_snapshot: 3,
            started_at: "2026-09-29T14:00:00.000Z",
            completed_at: null,
          },
        ],
      },
      {
        rows: [
          {
            ride_request_id: "ride-1",
            membership_status: "ACTIVE",
            status: "STARTED",
            seats_reserved: 1,
            fare_poysha: 7100,
          },
          {
            ride_request_id: "ride-2",
            membership_status: "ACTIVE",
            status: "STARTED",
            seats_reserved: 1,
            fare_poysha: 5900,
          },
        ],
      },
      { rows: [{ id: "ride-2", completed_at: "2026-09-29T14:30:00.000Z" }] },
      { rows: [] },
    ]);

    await expect(
      context.repository.dropOffRide(
        {
          driverUserId: "jashim-user",
          poolId: "pool-1",
          rideId: "ride-2",
        },
        () => "event-drop-2",
      ),
    ).resolves.toEqual({
      kind: "dropped_off",
      dropOff: {
        pool: {
          id: "pool-1",
          status: "STARTED",
          pickupZone: "Banani",
          capacity: 3,
          occupiedSeats: 1,
          availableSeats: 2,
          startedAt: "2026-09-29T14:00:00.000Z",
          completedAt: null,
        },
        droppedOffRideId: "ride-2",
        completedAt: "2026-09-29T14:30:00.000Z",
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
      expect.stringMatching(/FROM pools[\s\S]*driver_id = \$2[\s\S]*FOR UPDATE/),
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
      4,
      expect.stringMatching(
        /UPDATE ride_requests[\s\S]*status = 'COMPLETED'[\s\S]*completed_at = NOW\(\)/,
      ),
      ["ride-2"],
    );
    expect(context.client.query).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining("INSERT INTO ride_status_events"),
      [
        "event-drop-2",
        "ride-2",
        "pool-1",
        "jashim-user",
        "STARTED",
        "COMPLETED",
      ],
    );
    expect(
      context.client.query.mock.calls.some(([text]) =>
        String(text).includes("UPDATE pool_memberships"),
      ),
    ).toBe(false);
  });

  it("completes the pool when the final started member is dropped off", async () => {
    const context = createRepository([
      { rows: [{ driver_id: "driver-1" }] },
      {
        rows: [
          {
            id: "pool-1",
            status: "STARTED",
            pickup_zone: "Banani",
            capacity_snapshot: 3,
            started_at: "2026-09-29T14:00:00.000Z",
            completed_at: null,
          },
        ],
      },
      {
        rows: [
          {
            ride_request_id: "ride-1",
            membership_status: "ACTIVE",
            status: "STARTED",
            seats_reserved: 1,
            fare_poysha: 7100,
          },
          {
            ride_request_id: "ride-2",
            membership_status: "ACTIVE",
            status: "COMPLETED",
            seats_reserved: 1,
            fare_poysha: 5900,
          },
        ],
      },
      { rows: [{ id: "ride-1", completed_at: "2026-09-29T14:40:00.000Z" }] },
      { rows: [] },
      {
        rows: [
          {
            id: "pool-1",
            status: "COMPLETED",
            pickup_zone: "Banani",
            capacity_snapshot: 3,
            started_at: "2026-09-29T14:00:00.000Z",
            completed_at: "2026-09-29T14:40:01.000Z",
          },
        ],
      },
    ]);

    await expect(
      context.repository.dropOffRide(
        {
          driverUserId: "jashim-user",
          poolId: "pool-1",
          rideId: "ride-1",
        },
        () => "event-drop-1",
      ),
    ).resolves.toMatchObject({
      kind: "dropped_off",
      dropOff: {
        pool: {
          status: "COMPLETED",
          occupiedSeats: 0,
          availableSeats: 3,
          completedAt: "2026-09-29T14:40:01.000Z",
        },
        droppedOffRideId: "ride-1",
        completedAt: "2026-09-29T14:40:00.000Z",
      },
    });
    expect(context.client.query).toHaveBeenNthCalledWith(
      6,
      expect.stringMatching(
        /UPDATE pools[\s\S]*status = 'COMPLETED'[\s\S]*completed_at = NOW\(\)/,
      ),
      ["pool-1"],
    );
  });

  it.each([
    ["before start", "DRIVER_ARRIVED", "invalid_pool_transition"],
    ["already completed", "STARTED", "ride_not_started"],
  ] as const)(
    "rejects drop-off %s without writing",
    async (_label, poolStatus, expectedKind) => {
      const responses: Array<{ rows: unknown[] }> = [
        { rows: [{ driver_id: "driver-1" }] },
        {
          rows: [
            {
              id: "pool-1",
              status: poolStatus,
              pickup_zone: "Banani",
              capacity_snapshot: 3,
              started_at: poolStatus === "STARTED" ? "started" : null,
              completed_at: null,
            },
          ],
        },
      ];

      if (poolStatus === "STARTED") {
        responses.push({
          rows: [
            {
              ride_request_id: "ride-1",
              membership_status: "ACTIVE",
              status: "COMPLETED",
              seats_reserved: 1,
              fare_poysha: 8600,
            },
          ],
        });
      }

      const context = createRepository(responses);

      await expect(
        context.repository.dropOffRide(
          {
            driverUserId: "jashim-user",
            poolId: "pool-1",
            rideId: "ride-1",
          },
          () => "event-1",
        ),
      ).resolves.toEqual({ kind: expectedKind });
      expect(
        context.client.query.mock.calls.some(([text]) =>
          /^(?:\s*)(?:INSERT|UPDATE)\b/.test(String(text)),
        ),
      ).toBe(false);
    },
  );

  it("does not expose another driver's pool to drop-off", async () => {
    const context = createRepository([
      { rows: [{ driver_id: "driver-1" }] },
      { rows: [] },
    ]);

    await expect(
      context.repository.dropOffRide(
        {
          driverUserId: "jashim-user",
          poolId: "pool-other",
          rideId: "ride-1",
        },
        () => "event-1",
      ),
    ).resolves.toEqual({ kind: "pool_not_found" });
  });

  it("rejects an unexpected member state before any drop-off write", async () => {
    const context = createRepository([
      { rows: [{ driver_id: "driver-1" }] },
      {
        rows: [
          {
            id: "pool-1",
            status: "STARTED",
            pickup_zone: "Banani",
            capacity_snapshot: 3,
            started_at: "started",
            completed_at: null,
          },
        ],
      },
      {
        rows: [
          {
            ride_request_id: "ride-1",
            membership_status: "ACTIVE",
            status: "DRIVER_ARRIVED",
            seats_reserved: 1,
            fare_poysha: 8600,
          },
        ],
      },
    ]);

    await expect(
      context.repository.dropOffRide(
        {
          driverUserId: "jashim-user",
          poolId: "pool-1",
          rideId: "ride-1",
        },
        () => "event-1",
      ),
    ).resolves.toEqual({ kind: "pool_ride_state_mismatch" });
    expect(context.client.query).toHaveBeenCalledTimes(3);
  });

  it("creates a first pool, stores a solo fare, and records the matched event in one transaction", async () => {
    const context = createRepository([
      { rows: [onlineDriver] },
      { rows: [] },
      { rows: [requestedRide] },
      { rows: [activePool] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
    ]);
    let fareInput: unknown;

    const outcome = await context.repository.acceptRide(
      acceptanceInput,
      (ride, pooled) => {
        fareInput = { ride, pooled };
        return pooled ? 7100 : 8600;
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
          farePoysha: 8600,
          status: "ACTIVE",
        },
      },
    });
    expect(fareInput).toEqual({
      ride: {
        id: "ride-1",
        status: "REQUESTED",
        pickupZone: "Banani",
        destinationZone: "Mohakhali",
        seatsRequested: 1,
      },
      pooled: false,
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
      expect.stringContaining("INSERT INTO pool_memberships"),
      ["membership-1", "pool-1", "ride-1", 1, 8600],
    );
    expect(context.client.query).toHaveBeenNthCalledWith(
      6,
      expect.stringMatching(
        /UPDATE ride_requests[\s\S]*status = 'MATCHED'[\s\S]*WHERE id = \$1/,
      ),
      ["ride-1"],
    );
    expect(context.client.query).toHaveBeenNthCalledWith(
      7,
      expect.stringContaining("INSERT INTO ride_status_events"),
      ["event-1", "ride-1", "pool-1", "jashim-user", "REQUESTED", "MATCHED"],
    );
  });

  it("reuses a matching pickup pool, reprices active members, and returns its new occupancy", async () => {
    const context = createRepository([
      { rows: [onlineDriver] },
      { rows: [activePool] },
      {
        rows: [
          {
            membership_id: "membership-existing",
            ride_request_id: "ride-existing",
            membership_status: "ACTIVE",
            status: "MATCHED",
            pickup_zone: "Banani",
            destination_zone: "Mohakhali",
            seats_reserved: 1,
          },
        ],
      },
      { rows: [requestedRide] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
    ]);

    await expect(
      context.repository.acceptRide(
        acceptanceInput,
        (_ride, pooled) => (pooled ? 7100 : 8600),
      ),
    ).resolves.toMatchObject({
      kind: "accepted",
      acceptance: {
        pool: { id: "pool-1", occupiedSeats: 2, availableSeats: 1 },
      },
    });
    expect(context.client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringMatching(
        /FROM pool_memberships AS m[\s\S]*JOIN ride_requests AS r[\s\S]*FOR UPDATE OF m, r/,
      ),
      ["pool-1"],
    );
    expect(context.client.query).toHaveBeenNthCalledWith(
      5,
      expect.stringMatching(/UPDATE pool_memberships[\s\S]*SET fare_poysha = \$2/),
      ["membership-existing", 7100],
    );
    expect(context.client.query.mock.calls).toHaveLength(8);
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
        { rows: [] },
        { rows: [requestedRide] },
      ],
      "ride_not_compatible",
    ],
    [
      "full compatible pool",
      [
        { rows: [onlineDriver] },
        { rows: [activePool] },
        {
          rows: [
            {
              membership_status: "ACTIVE",
              status: "MATCHED",
              seats_reserved: 3,
            },
          ],
        },
        { rows: [requestedRide] },
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
            membership_status: "ACTIVE",
            status: "MATCHED",
            seats_reserved: 1,
          },
          {
            ride_request_id: "ride-2",
            membership_status: "ACTIVE",
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
            membership_status: "ACTIVE",
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
