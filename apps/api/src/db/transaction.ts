import type { Pool, PoolClient } from "pg";
import { db } from "./pool.js";

export type TransactionPool = Pick<Pool, "connect">;

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  pool: TransactionPool = db,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
