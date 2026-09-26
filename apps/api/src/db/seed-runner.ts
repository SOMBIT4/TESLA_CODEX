import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool } from "pg";
import { db } from "./pool.js";

export type SeedPool = Pick<Pool, "connect">;

async function listSqlFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
}

export async function runSeeds(
  pool: SeedPool = db,
  seedsDirectory: string,
): Promise<string[]> {
  const files = await listSqlFiles(seedsDirectory);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    for (const fileName of files) {
      const sql = await readFile(join(seedsDirectory, fileName), "utf8");
      await client.query(sql);
    }
    await client.query("COMMIT");
    return files;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
