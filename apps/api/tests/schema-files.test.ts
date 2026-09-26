import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationsDirectory = new URL(
  "../../../database/migrations/",
  import.meta.url,
);
const seedsDirectory = new URL("../../../database/seeds/", import.meta.url);

const migrationFiles = [
  "001_create_users.sql",
  "002_create_drivers.sql",
  "003_create_vehicles.sql",
  "004_create_ride_requests.sql",
  "005_create_pools.sql",
  "006_create_pool_memberships.sql",
  "007_create_ride_status_events.sql",
  "008_add_indexes.sql",
  "009_add_driver_availability_constraints.sql",
  "010_add_pool_matching_constraints.sql",
];

function readMigration(fileName: string): string {
  return readFileSync(new URL(fileName, migrationsDirectory), "utf8");
}

describe("database schema files", () => {
  it("keeps migrations in the documented dependency order", () => {
    expect(readdirSync(migrationsDirectory).sort()).toEqual(migrationFiles);
  });

  it("defines the required tables in their numbered migrations", () => {
    const expectedTables = [
      ["001_create_users.sql", "users"],
      ["002_create_drivers.sql", "drivers"],
      ["003_create_vehicles.sql", "vehicles"],
      ["004_create_ride_requests.sql", "ride_requests"],
      ["005_create_pools.sql", "pools"],
      ["006_create_pool_memberships.sql", "pool_memberships"],
      ["007_create_ride_status_events.sql", "ride_status_events"],
    ] as const;

    for (const [fileName, tableName] of expectedTables) {
      expect(readMigration(fileName)).toMatch(
        new RegExp(`CREATE TABLE ${tableName}`),
      );
    }
  });

  it("pins durable ride and pooling invariants", () => {
    const rides = readMigration("004_create_ride_requests.sql");
    const pools = readMigration("005_create_pools.sql");
    const memberships = readMigration("006_create_pool_memberships.sql");
    const events = readMigration("007_create_ride_status_events.sql");

    expect(rides).toContain("estimated_fare_poysha INTEGER NOT NULL");
    expect(rides).toContain("seats_requested SMALLINT NOT NULL");
    expect(rides).toContain("pickup_zone IN (");
    expect(rides).toContain("destination_zone IN (");
    expect(rides).toContain("'REQUESTED'");
    expect(rides).toContain("'CANCELLED'");
    expect(pools).toContain("capacity_snapshot SMALLINT NOT NULL");
    expect(pools).toContain("'MATCHED'");
    expect(pools).toContain("'COMPLETED'");
    expect(memberships).toContain("ride_request_id UUID NOT NULL UNIQUE");
    expect(memberships).toContain("seats_reserved SMALLINT NOT NULL");
    expect(events).toMatch(/actor_user_id UUID\s+REFERENCES users\(id\)/);
    expect(events).toContain("from_status VARCHAR(30)");
  });

  it("creates the indexes required by the documented query paths", () => {
    const indexes = readMigration("008_add_indexes.sql");

    expect(indexes).toContain("idx_ride_requests_passenger");
    expect(indexes).toContain("idx_ride_requests_status");
    expect(indexes).toContain("idx_ride_requests_pickup_destination");
    expect(indexes).toContain("idx_pools_driver_status");
    expect(indexes).toContain("idx_pool_memberships_pool");
    expect(indexes).toContain("idx_status_events_ride");
  });

  it("protects driver availability with a timestamp and one active vehicle", () => {
    const availability = readMigration(
      "009_add_driver_availability_constraints.sql",
    );

    expect(availability).toContain(
      "ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
    );
    expect(availability).toContain(
      "CREATE UNIQUE INDEX uq_vehicles_active_driver",
    );
    expect(availability).toMatch(/ON vehicles\(driver_id\)\s+WHERE is_active/);
  });

  it("protects pool matching with a pickup zone and one active pool per driver", () => {
    const poolMatching = readMigration(
      "010_add_pool_matching_constraints.sql",
    );

    expect(poolMatching).toContain(
      "ADD COLUMN pickup_zone VARCHAR(50) NOT NULL",
    );
    expect(poolMatching).toContain("'Banani'");
    expect(poolMatching).toContain("'Bashundhara'");
    expect(poolMatching).toContain(
      "CREATE UNIQUE INDEX uq_pools_driver_active",
    );
    expect(poolMatching).toMatch(
      /ON pools\(driver_id\)\s+WHERE status IN \('MATCHED', 'DRIVER_ARRIVED', 'STARTED'\)/,
    );
  });

  it("contains deterministic demo users and Bullet capacity", () => {
    const seedFiles = readdirSync(seedsDirectory).sort();
    const seedSql = seedFiles
      .map((fileName) =>
        readFileSync(new URL(fileName, seedsDirectory), "utf8"),
      )
      .join("\n");

    expect(seedFiles).toEqual([
      "001_demo_users.sql",
      "002_demo_driver_vehicle.sql",
    ]);
    expect(seedSql).toContain("Jashim");
    expect(seedSql).toContain("Nusrat");
    expect(seedSql).toContain("Rafiq");
    expect(seedSql).toContain("Shirin");
    expect(seedSql).toContain("Bullet");
    expect(seedSql).toContain("capacity");
    expect(seedSql).toContain("3");
  });
});
