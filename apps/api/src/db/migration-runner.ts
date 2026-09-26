import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool, PoolClient, QueryResultRow } from "pg";
import { db } from "./pool.js";

export type MigrationClient = Pick<PoolClient, "query" | "release">;
export type MigrationPool = Pick<Pool, "connect">;

async function listSqlFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
}

export async function runMigrations(
  pool: MigrationPool = db,
  migrationsDirectory: string,
): Promise<string[]> {
  const files = await listSqlFiles(migrationsDirectory);
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const appliedResult = await client.query<
      QueryResultRow & { version: string }
    >("SELECT version FROM schema_migrations");
    const appliedVersions = new Set(
      appliedResult.rows.map((row) => String(row.version)),
    );
    const newlyApplied: string[] = [];

    for (const fileName of files) {
      if (appliedVersions.has(fileName)) {
        continue;
      }

      const sql = await readFile(join(migrationsDirectory, fileName), "utf8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [fileName],
        );
        await client.query("COMMIT");
        newlyApplied.push(fileName);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    return newlyApplied;
  } finally {
    client.release();
  }
}
