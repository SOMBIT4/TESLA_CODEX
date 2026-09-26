import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runSeeds } from "./seed-runner.js";
import { closeDb, db } from "./pool.js";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../",
);
const seedsDirectory = resolve(repositoryRoot, "database/seeds");

try {
  const seeded = await runSeeds(db, seedsDirectory);
  console.info(`Database seed files applied: ${seeded.length}`);
} finally {
  await closeDb();
}
