import { Pool } from "pg";
import { env } from "../config/env.js";

export const db = new Pool({
  connectionString: env.DATABASE_URL,
});

export async function closeDb(): Promise<void> {
  await db.end();
}
