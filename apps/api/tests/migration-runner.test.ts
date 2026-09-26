import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  runMigrations,
  type MigrationPool,
} from "../src/db/migration-runner.js";
import { runSeeds } from "../src/db/seed-runner.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true })),
  );
});

function createFakePool(appliedVersions: string[] = []) {
  const applied = new Set(appliedVersions);
  const queries: string[] = [];
  const values: unknown[][] = [];
  const client = {
    query: vi.fn(async (sql: string, parameters?: unknown[]) => {
      queries.push(sql);
      values.push(parameters ?? []);

      if (sql.startsWith("SELECT version")) {
        return {
          rows: [...applied].map((version) => ({ version })),
          rowCount: applied.size,
        };
      }

      if (sql.startsWith("INSERT INTO schema_migrations")) {
        applied.add(String(parameters?.[0]));
      }

      if (sql.includes("-- FAIL")) {
        throw new Error("migration failed");
      }

      return { rows: [], rowCount: 0 };
    }),
    release: vi.fn(),
  };
  const pool = {
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as MigrationPool;

  return { applied, client, pool, queries, values };
}

async function createSqlDirectory(
  files: Record<string, string>,
): Promise<string> {
  const directory = await mkdtemp(
    join(tmpdir(), "dhaka-tesla-pool-migrations-"),
  );
  temporaryDirectories.push(directory);

  await Promise.all(
    Object.entries(files).map(([fileName, sql]) =>
      writeFile(join(directory, fileName), sql, "utf8"),
    ),
  );

  return directory;
}

describe("database migration runner", () => {
  it("sorts files, skips applied versions, records new versions, and releases the client", async () => {
    const directory = await createSqlDirectory({
      "002_second.sql": "CREATE TABLE second_table;",
      "001_first.sql": "CREATE TABLE first_table;",
      "003_third.sql": "CREATE TABLE third_table;",
    });
    const { applied, client, pool, queries } = createFakePool([
      "001_first.sql",
    ]);

    const newlyApplied = await runMigrations(pool, directory);

    expect(newlyApplied).toEqual(["002_second.sql", "003_third.sql"]);
    expect([...applied]).toEqual([
      "001_first.sql",
      "002_second.sql",
      "003_third.sql",
    ]);
    expect(
      queries.some((sql) =>
        sql.includes("CREATE TABLE IF NOT EXISTS schema_migrations"),
      ),
    ).toBe(true);
    expect(queries.indexOf("CREATE TABLE second_table;")).toBeLessThan(
      queries.indexOf("CREATE TABLE third_table;"),
    );
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("rolls back a failed migration and does not record its version", async () => {
    const directory = await createSqlDirectory({
      "001_broken.sql": "CREATE TABLE broken_table; -- FAIL",
    });
    const { applied, client, pool, queries } = createFakePool();

    await expect(runMigrations(pool, directory)).rejects.toThrow(
      "migration failed",
    );

    expect(queries).toContain("ROLLBACK");
    expect(applied).toEqual(new Set<string>());
    expect(client.release).toHaveBeenCalledOnce();
  });
});

describe("database seed runner", () => {
  it("executes seed files in lexical order inside one transaction", async () => {
    const directory = await createSqlDirectory({
      "002_second.sql": "-- second seed",
      "001_first.sql": "-- first seed",
    });
    const { client, pool, queries } = createFakePool();

    await runSeeds(pool, directory);

    expect(queries).toEqual([
      "BEGIN",
      "-- first seed",
      "-- second seed",
      "COMMIT",
    ]);
    expect(client.release).toHaveBeenCalledOnce();
  });
});
