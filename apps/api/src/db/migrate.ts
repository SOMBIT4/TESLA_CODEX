import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closeDb, db } from "./pool.js";
import { runMigrations } from "./migration-runner.js";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../",
);
const migrationsDirectory = resolve(repositoryRoot, "database/migrations");

try {
  const applied = await runMigrations(db, migrationsDirectory);
  console.info(`Database migrations applied: ${applied.length}`);
} finally {
  await closeDb();
}
