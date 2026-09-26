import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runMigrations } from "./migration-runner.js";
import { closeDb, db } from "./pool.js";
import { runSeeds } from "./seed-runner.js";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../",
);
const migrationsDirectory = resolve(repositoryRoot, "database/migrations");
const seedsDirectory = resolve(repositoryRoot, "database/seeds");

try {
  const applied = await runMigrations(db, migrationsDirectory);
  const seeded = await runSeeds(db, seedsDirectory);
  console.info(
    `Database setup complete: ${applied.length} migrations, ${seeded.length} seed files.`,
  );
} finally {
  await closeDb();
}
