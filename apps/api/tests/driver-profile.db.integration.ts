import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { DriverRepository } from "../src/modules/driver/driver.repository.js";

const poolTestDatabaseUrl = process.env.POOL_TEST_DATABASE_URL;

if (!poolTestDatabaseUrl) {
  throw new Error(
    "POOL_TEST_DATABASE_URL is required for the PostgreSQL driver profile lock test.",
  );
}

process.env.DATABASE_URL = poolTestDatabaseUrl;

interface QueryResult<T> {
  rows: T[];
}

interface DatabaseSession {
  query<T = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<T>>;
  release(): void;
}

interface DatabaseClient {
  query<T = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<T>>;
  connect(): Promise<DatabaseSession>;
  end(): Promise<void>;
}

interface DriverFixture {
  driverUserId: string;
  driverId: string;
  vehicleId: string;
}

let db: DatabaseClient;
let repository: DriverRepository;
let fixture: DriverFixture | undefined;

beforeAll(async () => {
  const database = await import("../src/db/pool.js");
  const driver = await import("../src/modules/driver/driver.repository.js");

  db = database.db as unknown as DatabaseClient;
  repository = driver.createDriverRepository();
});

afterEach(async () => {
  if (!fixture) {
    return;
  }

  await db.query("DELETE FROM vehicles WHERE id = $1", [fixture.vehicleId]);
  await db.query("DELETE FROM drivers WHERE id = $1", [fixture.driverId]);
  await db.query("DELETE FROM users WHERE id = $1", [fixture.driverUserId]);
  fixture = undefined;
});

afterAll(async () => {
  await db?.end();
});

describe("driver vehicle profile concurrency", () => {
  it("observes an online transition queued ahead of a vehicle edit", async () => {
    fixture = await createFixture(db);
    const lockHolder = await db.connect();

    try {
      await lockHolder.query("BEGIN");
      await lockHolder.query(
        "SELECT id FROM drivers WHERE id = $1 FOR UPDATE",
        [fixture.driverId],
      );

      const availabilityUpdate = repository.setOnlineStatusIfAllowed(
        fixture.driverUserId,
        true,
      );
      await waitForLockWaiter("UPDATE drivers AS d");

      const vehicleUpdate = repository.updateVehicleProfile(
        fixture.driverUserId,
        { name: "Should Not Save", capacity: 4 },
      );
      await waitForLockWaiter("SELECT d.id AS driver_id");

      await lockHolder.query("COMMIT");

      await expect(availabilityUpdate).resolves.toMatchObject({
        isOnline: true,
      });
      await expect(vehicleUpdate).resolves.toEqual({
        kind: "vehicle_profile_locked",
      });

      const savedVehicle = await db.query<{
        name: string;
        capacity: number;
      }>("SELECT name, capacity FROM vehicles WHERE id = $1", [
        fixture.vehicleId,
      ]);
      expect(savedVehicle.rows).toEqual([{ name: "Bullet", capacity: 3 }]);
    } finally {
      await lockHolder.query("ROLLBACK").catch(() => undefined);
      lockHolder.release();
    }
  });
});

async function createFixture(client: DatabaseClient): Promise<DriverFixture> {
  const driverUserId = randomUUID();
  const driverId = randomUUID();
  const vehicleId = randomUUID();
  const testTag = randomUUID();

  await client.query(
    `INSERT INTO users (id, name, email, password_hash, role)
     VALUES ($1, 'Driver Profile Test', $2, 'not-used-in-test', 'DRIVER')`,
    [driverUserId, `driver-profile-${testTag}@example.test`],
  );
  await client.query(
    "INSERT INTO drivers (id, user_id, is_online) VALUES ($1, $2, FALSE)",
    [driverId, driverUserId],
  );
  await client.query(
    `INSERT INTO vehicles (id, driver_id, name, capacity, is_active)
     VALUES ($1, $2, 'Bullet', 3, TRUE)`,
    [vehicleId, driverId],
  );

  return { driverUserId, driverId, vehicleId };
}

async function waitForLockWaiter(queryFragment: string): Promise<void> {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    const result = await db.query<{ query: string }>(
      `SELECT query
       FROM pg_stat_activity
       WHERE datname = current_database()
         AND pid <> pg_backend_pid()
         AND wait_event_type = 'Lock'
         AND POSITION($1 IN query) > 0`,
      [queryFragment],
    );

    if (result.rows.length > 0) {
      return;
    }

    await delay(20);
  }

  throw new Error(
    `Timed out waiting for database query lock: ${queryFragment}`,
  );
}
