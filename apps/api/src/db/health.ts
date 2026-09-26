import type { Pool } from "pg";
import { db } from "./pool.js";

export type HealthDatabase = Pick<Pool, "query">;

export async function checkDatabaseHealth(
  pool: HealthDatabase = db,
): Promise<void> {
  await pool.query("SELECT 1");
}
