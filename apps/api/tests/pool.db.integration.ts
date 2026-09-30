import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type {
  PoolAcceptance,
  PoolDropOffTransition,
  PoolLifecycleTransition,
} from "../src/modules/pools/pool.types.js";

const poolTestDatabaseUrl = process.env.POOL_TEST_DATABASE_URL;

if (!poolTestDatabaseUrl) {
  throw new Error(
    "POOL_TEST_DATABASE_URL is required for the PostgreSQL pool concurrency test.",
  );
}

process.env.DATABASE_URL = poolTestDatabaseUrl;

interface DatabaseClient {
  query<T = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
}

interface PoolService {
  acceptRide(driverUserId: string, rideId: string): Promise<PoolAcceptance>;
  arrive(
    driverUserId: string,
    poolId: string,
  ): Promise<PoolLifecycleTransition>;
  start(
    driverUserId: string,
    poolId: string,
  ): Promise<PoolLifecycleTransition>;
  complete(
    driverUserId: string,
    poolId: string,
  ): Promise<PoolLifecycleTransition>;
  dropOffRide(
    driverUserId: string,
    poolId: string,
    rideId: string,
  ): Promise<PoolDropOffTransition>;
}

interface Fixture {
  driverUserId: string;
  driverId: string;
  vehicleId: string;
  passengerUserIds: string[];
  rideIds: string[];
}

interface FixtureOptions {
  firstRideSeats?: number;
  thirdRideSeats?: number;
}

let db: DatabaseClient;
let closeDb: () => Promise<void>;
let poolService: PoolService;
let fixture: Fixture | undefined;

beforeAll(async () => {
  const database = await import("../src/db/pool.js");
  const pools = await import("../src/modules/pools/pool.service.js");

  db = database.db;
  closeDb = database.closeDb;
  poolService = pools.createPoolService();
});

afterEach(async () => {
  if (!fixture) {
    return;
  }

  await db.query(
    `DELETE FROM ride_status_events
     WHERE ride_request_id = ANY($1::uuid[]) OR pool_id IN (
       SELECT id FROM pools WHERE driver_id = $2
     )`,
    [fixture.rideIds, fixture.driverId],
  );
  await db.query(
    "DELETE FROM pool_memberships WHERE ride_request_id = ANY($1::uuid[])",
    [fixture.rideIds],
  );
  await db.query("DELETE FROM pools WHERE driver_id = $1", [fixture.driverId]);
  await db.query("DELETE FROM ride_requests WHERE id = ANY($1::uuid[])", [
    fixture.rideIds,
  ]);
  await db.query("DELETE FROM vehicles WHERE id = $1", [fixture.vehicleId]);
  await db.query("DELETE FROM drivers WHERE id = $1", [fixture.driverId]);
  await db.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
    [fixture.driverUserId, ...fixture.passengerUserIds],
  ]);

  fixture = undefined;
});

afterAll(async () => {
  await closeDb?.();
});

describe("pool acceptance concurrency", () => {
  it("counts matched members when checking capacity", async () => {
    fixture = await createFixture(db, {
      firstRideSeats: 1,
      thirdRideSeats: 2,
    });

    await poolService.acceptRide(fixture.driverUserId, fixture.rideIds[0]);
    await poolService.acceptRide(fixture.driverUserId, fixture.rideIds[1]);

    await expect(
      poolService.acceptRide(fixture.driverUserId, fixture.rideIds[2]),
    ).rejects.toMatchObject({ code: "POOL_FULL" });

    const membershipCount = await db.query<{ count: number }>(
      `SELECT COUNT(*)::INTEGER AS count
       FROM pool_memberships
       WHERE pool_id IN (SELECT id FROM pools WHERE driver_id = $1)
         AND status = 'ACTIVE'`,
      [fixture.driverId],
    );

    expect(membershipCount.rows[0]?.count).toBe(2);
  });

  it("allows exactly one concurrent claim for the final seat", async () => {
    fixture = await createFixture(db);

    await poolService.acceptRide(fixture.driverUserId, fixture.rideIds[0]);

    const results = await Promise.allSettled([
      poolService.acceptRide(fixture.driverUserId, fixture.rideIds[1]),
      poolService.acceptRide(fixture.driverUserId, fixture.rideIds[2]),
    ]);
    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<PoolAcceptance> =>
        result.status === "fulfilled",
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({ code: "POOL_FULL" });

    const activeSeats = await db.query<{ occupied_seats: number }>(
      `SELECT COALESCE(SUM(seats_reserved), 0)::INTEGER AS occupied_seats
       FROM pool_memberships
       WHERE pool_id IN (SELECT id FROM pools WHERE driver_id = $1)
         AND status = 'ACTIVE'`,
      [fixture.driverId],
    );
    const membershipCounts = await db.query<{
      ride_request_id: string;
      membership_count: number;
    }>(
      `SELECT ride_request_id, COUNT(*)::INTEGER AS membership_count
       FROM pool_memberships
       WHERE ride_request_id = ANY($1::uuid[])
       GROUP BY ride_request_id`,
      [fixture.rideIds],
    );

    expect(activeSeats.rows[0]?.occupied_seats).toBe(3);
    expect(membershipCounts.rows).toHaveLength(2);
    expect(membershipCounts.rows.map((row) => row.membership_count)).toEqual([
      1, 1,
    ]);
  });
});

describe("pool lifecycle persistence", () => {
  it("persists arrival and start for a matched pool", async () => {
    fixture = await createFixture(db);

    const acceptance = await poolService.acceptRide(
      fixture.driverUserId,
      fixture.rideIds[0],
    );

    const arrival = await poolService.arrive(
      fixture.driverUserId,
      acceptance.pool.id,
    );
    expect(arrival.pool.status).toBe("DRIVER_ARRIVED");
    expect(arrival.pool.startedAt).toBeNull();
    expect(arrival.pool.completedAt).toBeNull();

    const start = await poolService.start(
      fixture.driverUserId,
      acceptance.pool.id,
    );
    expect(start.pool.status).toBe("STARTED");
    expect(start.pool.startedAt).not.toBeNull();
    expect(start.pool.completedAt).toBeNull();

    const persistedStatuses = await db.query<{
      pool_status: string;
      ride_status: string;
    }>(
      `SELECT p.status AS pool_status,
              r.status AS ride_status
       FROM pools AS p
       JOIN pool_memberships AS m
         ON m.pool_id = p.id
       JOIN ride_requests AS r
         ON r.id = m.ride_request_id
       WHERE p.id = $1`,
      [acceptance.pool.id],
    );

    expect(persistedStatuses.rows).toEqual([
      { pool_status: "STARTED", ride_status: "STARTED" },
    ]);
  });
});

describe("per-rider drop-off persistence", () => {
  it("completes riders independently, preserves fares, and completes the pool last", async () => {
    const testFixture = await createFixture(db, { firstRideSeats: 1 });
    fixture = testFixture;

    const firstAcceptance = await poolService.acceptRide(
      testFixture.driverUserId,
      testFixture.rideIds[0],
    );
    await poolService.acceptRide(testFixture.driverUserId, testFixture.rideIds[1]);
    await poolService.arrive(testFixture.driverUserId, firstAcceptance.pool.id);
    await poolService.start(testFixture.driverUserId, firstAcceptance.pool.id);

    const faresBeforeDropOff = await membershipFares(db, testFixture.rideIds);

    const partial = await poolService.dropOffRide(
      testFixture.driverUserId,
      firstAcceptance.pool.id,
      testFixture.rideIds[1],
    );
    expect(partial.pool.status).toBe("STARTED");
    expect(partial.pool.occupiedSeats).toBe(1);
    expect(partial.pool.availableSeats).toBe(2);
    expect(partial.droppedOffRideId).toBe(testFixture.rideIds[1]);
    expect(partial.completedAt).not.toBeNull();
    expect(await membershipFares(db, testFixture.rideIds)).toEqual(
      faresBeforeDropOff,
    );

    const partialStatuses = await db.query<{
      ride_request_id: string;
      ride_status: string;
      completed_at: Date | string | null;
      pool_status: string;
    }>(
      `SELECT r.id AS ride_request_id,
              r.status AS ride_status,
              r.completed_at,
              p.status AS pool_status
       FROM ride_requests AS r
       JOIN pool_memberships AS m ON m.ride_request_id = r.id
       JOIN pools AS p ON p.id = m.pool_id
       WHERE r.id = ANY($1::uuid[])
       ORDER BY r.id`,
      [testFixture.rideIds.slice(0, 2)],
    );
    expect(
      partialStatuses.rows.find(
        (row) => row.ride_request_id === testFixture.rideIds[1],
      ),
    ).toMatchObject({ ride_status: "COMPLETED", pool_status: "STARTED" });
    expect(
      partialStatuses.rows.find(
        (row) => row.ride_request_id === testFixture.rideIds[1],
      )?.completed_at,
    ).not.toBeNull();
    expect(
      partialStatuses.rows.find(
        (row) => row.ride_request_id === testFixture.rideIds[0],
      ),
    ).toMatchObject({ ride_status: "STARTED", pool_status: "STARTED" });

    await expect(
      poolService.dropOffRide(
        testFixture.driverUserId,
        firstAcceptance.pool.id,
        testFixture.rideIds[1],
      ),
    ).rejects.toMatchObject({
      code: "RIDE_NOT_STARTED",
      statusCode: 409,
    });

    const final = await poolService.dropOffRide(
      testFixture.driverUserId,
      firstAcceptance.pool.id,
      testFixture.rideIds[0],
    );
    expect(final.pool.status).toBe("COMPLETED");
    expect(final.pool.occupiedSeats).toBe(0);
    expect(final.pool.availableSeats).toBe(3);
    expect(final.pool.completedAt).not.toBeNull();
    expect(await membershipFares(db, testFixture.rideIds)).toEqual(
      faresBeforeDropOff,
    );

    const completionInvariant = await db.query<{ valid: boolean }>(
      `SELECT bool_and((status = 'COMPLETED') = (completed_at IS NOT NULL)) AS valid
       FROM ride_requests
       WHERE id = ANY($1::uuid[])`,
      [testFixture.rideIds.slice(0, 2)],
    );
    expect(completionInvariant.rows[0]?.valid).toBe(true);

    const eventCount = await db.query<{ count: number }>(
      `SELECT COUNT(*)::INTEGER AS count
       FROM ride_status_events
       WHERE ride_request_id = ANY($1::uuid[])
         AND from_status = 'STARTED'
         AND to_status = 'COMPLETED'`,
      [testFixture.rideIds.slice(0, 2)],
    );
    expect(eventCount.rows[0]?.count).toBe(2);
  });

  it("rejects drop-off before start without changing the ride", async () => {
    fixture = await createFixture(db, { firstRideSeats: 1 });

    const acceptance = await poolService.acceptRide(
      fixture.driverUserId,
      fixture.rideIds[0],
    );

    await expect(
      poolService.dropOffRide(
        fixture.driverUserId,
        acceptance.pool.id,
        fixture.rideIds[0],
      ),
    ).rejects.toMatchObject({
      code: "INVALID_POOL_TRANSITION",
      statusCode: 409,
    });

    const ride = await db.query<{ status: string; completed_at: null }>(
      "SELECT status, completed_at FROM ride_requests WHERE id = $1",
      [fixture.rideIds[0]],
    );
    expect(ride.rows[0]).toEqual({
      status: "MATCHED",
      completed_at: null,
    });
  });
});

describe("pool membership fares", () => {
  it("stores the solo fare for the first member of a new pool", async () => {
    fixture = await createFixture(db, { firstRideSeats: 1 });

    const acceptance = await poolService.acceptRide(
      fixture.driverUserId,
      fixture.rideIds[0],
    );

    expect(acceptance.membership.farePoysha).toBe(8600);

    const storedFare = await db.query<{ fare_poysha: number }>(
      `SELECT fare_poysha
       FROM pool_memberships
       WHERE ride_request_id = $1`,
      [fixture.rideIds[0]],
    );

    expect(storedFare.rows).toEqual([{ fare_poysha: 8600 }]);
  });

  it("reprices active members when riders join and preserves fares after start", async () => {
    fixture = await createFixture(db, { firstRideSeats: 1 });

    const firstAcceptance = await poolService.acceptRide(
      fixture.driverUserId,
      fixture.rideIds[0],
    );
    const secondAcceptance = await poolService.acceptRide(
      fixture.driverUserId,
      fixture.rideIds[1],
    );

    expect(secondAcceptance.membership.farePoysha).toBe(5900);
    expect(
      await membershipFares(db, fixture.rideIds.slice(0, 2)),
    ).toEqual({
      [fixture.rideIds[0]]: 7100,
      [fixture.rideIds[1]]: 5900,
    });

    const thirdAcceptance = await poolService.acceptRide(
      fixture.driverUserId,
      fixture.rideIds[2],
    );

    expect(thirdAcceptance.membership.farePoysha).toBe(7100);
    const faresBeforeStart = await membershipFares(db, fixture.rideIds);
    expect(faresBeforeStart).toEqual({
      [fixture.rideIds[0]]: 7100,
      [fixture.rideIds[1]]: 5900,
      [fixture.rideIds[2]]: 7100,
    });

    await poolService.arrive(fixture.driverUserId, firstAcceptance.pool.id);
    await poolService.start(fixture.driverUserId, firstAcceptance.pool.id);

    expect(await membershipFares(db, fixture.rideIds)).toEqual(
      faresBeforeStart,
    );
  });
});

async function membershipFares(
  client: DatabaseClient,
  rideIds: string[],
): Promise<Record<string, number>> {
  const result = await client.query<{
    ride_request_id: string;
    fare_poysha: number;
  }>(
    `SELECT ride_request_id, fare_poysha
     FROM pool_memberships
     WHERE ride_request_id = ANY($1::uuid[])`,
    [rideIds],
  );

  return Object.fromEntries(
    result.rows.map((row) => [row.ride_request_id, row.fare_poysha]),
  );
}

async function createFixture(
  client: DatabaseClient,
  { firstRideSeats = 2, thirdRideSeats = 1 }: FixtureOptions = {},
): Promise<Fixture> {
  const driverUserId = randomUUID();
  const driverId = randomUUID();
  const vehicleId = randomUUID();
  const passengerUserIds = [randomUUID(), randomUUID(), randomUUID()];
  const rideIds = [randomUUID(), randomUUID(), randomUUID()];
  const testId = randomUUID();

  await client.query(
    `INSERT INTO users (id, name, email, password_hash, role)
     VALUES
       ($1, 'Pool Test Driver', $2, 'not-used-in-test', 'DRIVER'),
       ($3, 'Pool Test Passenger A', $4, 'not-used-in-test', 'PASSENGER'),
       ($5, 'Pool Test Passenger B', $6, 'not-used-in-test', 'PASSENGER'),
       ($7, 'Pool Test Passenger C', $8, 'not-used-in-test', 'PASSENGER')`,
    [
      driverUserId,
      `pool-driver-${testId}@example.test`,
      passengerUserIds[0],
      `pool-passenger-a-${testId}@example.test`,
      passengerUserIds[1],
      `pool-passenger-b-${testId}@example.test`,
      passengerUserIds[2],
      `pool-passenger-c-${testId}@example.test`,
    ],
  );
  await client.query(
    "INSERT INTO drivers (id, user_id, is_online) VALUES ($1, $2, TRUE)",
    [driverId, driverUserId],
  );
  await client.query(
    `INSERT INTO vehicles (id, driver_id, name, capacity, is_active)
     VALUES ($1, $2, 'Pool Test Vehicle', 3, TRUE)`,
    [vehicleId, driverId],
  );
  await client.query(
    `INSERT INTO ride_requests (
       id,
       passenger_id,
       pickup_zone,
       destination_zone,
       seats_requested,
       status,
       estimated_fare_poysha
     )
     VALUES
       ($1, $2, 'Banani', 'Mohakhali', $7, 'REQUESTED', $8),
       ($3, $4, 'Banani', 'Gulshan 1', 1, 'REQUESTED', 7400),
       ($5, $6, 'Banani', 'Mohakhali', $9, 'REQUESTED', $10)`,
    [
      rideIds[0],
      passengerUserIds[0],
      rideIds[1],
      passengerUserIds[1],
      rideIds[2],
      passengerUserIds[2],
      firstRideSeats,
      firstRideSeats * 8600,
      thirdRideSeats,
      thirdRideSeats * 8600,
    ],
  );

  return {
    driverUserId,
    driverId,
    vehicleId,
    passengerUserIds,
    rideIds,
  };
}
