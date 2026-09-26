import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

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
  acceptRide(driverUserId: string, rideId: string): Promise<unknown>;
}

interface Fixture {
  driverUserId: string;
  driverId: string;
  vehicleId: string;
  passengerUserIds: string[];
  rideIds: string[];
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
  it("allows exactly one concurrent claim for the final seat", async () => {
    fixture = await createFixture(db);

    await poolService.acceptRide(fixture.driverUserId, fixture.rideIds[0]);

    const results = await Promise.allSettled([
      poolService.acceptRide(fixture.driverUserId, fixture.rideIds[1]),
      poolService.acceptRide(fixture.driverUserId, fixture.rideIds[2]),
    ]);
    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<unknown> =>
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

async function createFixture(client: DatabaseClient): Promise<Fixture> {
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
       ($1, $2, 'Banani', 'Mohakhali', 2, 'REQUESTED', 17200),
       ($3, $4, 'Banani', 'Gulshan 1', 1, 'REQUESTED', 7400),
       ($5, $6, 'Banani', 'Mohakhali', 1, 'REQUESTED', 8600)`,
    [
      rideIds[0],
      passengerUserIds[0],
      rideIds[1],
      passengerUserIds[1],
      rideIds[2],
      passengerUserIds[2],
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
