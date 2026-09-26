# Database Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the PostgreSQL foundation, initial relational schema, deterministic demo seeds, migration commands, and a database-aware API health check for the Dhaka Tesla Pool MVP.

**Architecture:** Keep PostgreSQL access behind `apps/api/src/db`, with a shared pool, transaction helper, and health query. Keep schema evolution in numbered SQL files under `database/migrations`, deterministic demo data under `database/seeds`, and thin TypeScript runners under the API package. The API health endpoint remains database-independent while `/health/db` reports PostgreSQL readiness.

**Tech Stack:** Node.js 24, TypeScript, Express 5, PostgreSQL 16, `pg`, Vitest, raw SQL, pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-09-25-dhaka-tesla-pool-design.md`, `docs/ERD.md`, `dhaka-tesla-pool-docs/docs/DATABASE.md`

## Global Constraints

- Use raw SQL through `pg`; do not add an ORM or Prisma.
- Use numbered migrations in the documented order: users, drivers, vehicles, ride requests, pools, memberships, status events, indexes.
- Preserve poysha as integer columns and preserve `capacity_snapshot` on pools.
- Enforce role, status, positive seat/capacity, foreign-key, unique-email, one-driver-profile, and one-membership-per-ride invariants in PostgreSQL.
- Migration and seed commands must be explicit and idempotent; never silently drop data.
- Demo seed identity is Jashim/ Bullet / Nusrat / Rafiq / Shirin, with Bullet capacity 3.
- Do not commit or push; the user owns Git operations and will receive a manual checkpoint at the end.

## Review Focus

- A migration must not be recorded when its SQL fails; test rollback and release behavior in the runner.
- Re-running migrations and seeds must be safe; test applied-version skipping and seed idempotence.
- Pool capacity must remain explainable through `capacity_snapshot`; pin the column and positive constraint in schema tests.
- Unsupported zones, invalid roles/statuses, duplicate emails, duplicate driver profiles, and duplicate ride memberships must be rejected by database constraints.
- `/health` must stay usable without PostgreSQL while `/health/db` must expose a stable failure envelope when the database is unavailable.

---

### Task 1: PostgreSQL API foundation

**Files:**
- Modify: `apps/api/package.json`
- Modify: `package.json`
- Create: `apps/api/src/db/pool.ts`
- Create: `apps/api/src/db/transaction.ts`
- Create: `apps/api/src/db/health.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/tests/database.test.ts`

**Interfaces:**
- Consumes: existing `env.DATABASE_URL`, `AppError`, and Express middleware.
- Produces: `db`, `closeDb()`, `withTransaction()`, `checkDatabaseHealth()`, and `GET /health/db` for later repositories and Docker checks.

- [ ] **Step 1: Write failing tests**

Test that `withTransaction` commits and releases a fake client on success, rolls back and releases on failure, and that `/health/db` returns `{ data: { status: "ok", service: "database" } }` when the health query succeeds and a stable `503 DATABASE_UNAVAILABLE` error when it fails.

- [ ] **Step 2: Run the focused tests and verify the expected failure**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/database.test.ts`

Expected: FAIL because the database modules and route do not exist yet.

- [ ] **Step 3: Add `pg` and implement the database foundation**

Add `pg` and `@types/pg`. Export a singleton `Pool` configured from `env.DATABASE_URL`, a transaction helper that uses one checked-out `PoolClient` for `BEGIN`/callback/`COMMIT`, and `checkDatabaseHealth()` that executes `SELECT 1`. Add `GET /health/db` without making `/health` connect to PostgreSQL.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/database.test.ts`

Expected: all database foundation tests pass.

---

### Task 2: Numbered PostgreSQL schema and deterministic seeds

**Files:**
- Create: `database/migrations/001_create_users.sql`
- Create: `database/migrations/002_create_drivers.sql`
- Create: `database/migrations/003_create_vehicles.sql`
- Create: `database/migrations/004_create_ride_requests.sql`
- Create: `database/migrations/005_create_pools.sql`
- Create: `database/migrations/006_create_pool_memberships.sql`
- Create: `database/migrations/007_create_ride_status_events.sql`
- Create: `database/migrations/008_add_indexes.sql`
- Create: `database/seeds/001_demo_users.sql`
- Create: `database/seeds/002_demo_driver_vehicle.sql`
- Test: `apps/api/tests/schema-files.test.ts`

**Interfaces:**
- Consumes: the table and invariant definitions in the ERD and database design docs.
- Produces: executable SQL with the exact table names, status values, supported Dhaka zones, poysha columns, indexes, foreign keys, and deterministic demo IDs expected by later feature branches.

- [ ] **Step 1: Write failing schema and seed contract tests**

Assert the eight migration filenames are ordered, each required table exists in the expected migration, ride requests contain the supported zone checks and lifecycle statuses, pools contain `capacity_snapshot`, memberships enforce unique `ride_request_id`, status events retain actor/ride/pool references, required indexes exist, and seed files contain the five story identities plus Bullet capacity 3.

- [ ] **Step 2: Run the focused schema tests and verify the expected failure**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/schema-files.test.ts`

Expected: FAIL because the migration and seed directories are not implemented.

- [ ] **Step 3: Implement the numbered migrations and idempotent seeds**

Create `schema_migrations` in the runner rather than mixing runner metadata into the domain migration numbering. Add PostgreSQL constraints and indexes from the maintained database documentation. Use fixed UUIDs and `ON CONFLICT` seed statements so repeated setup does not duplicate demo data.

- [ ] **Step 4: Run the focused schema tests and verify they pass**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/schema-files.test.ts`

Expected: all schema and seed contract tests pass.

---

### Task 3: Migration, seed, and database setup commands

**Files:**
- Create: `apps/api/src/db/migration-runner.ts`
- Create: `apps/api/src/db/seed-runner.ts`
- Create: `apps/api/src/db/migrate.ts`
- Create: `apps/api/src/db/seed.ts`
- Create: `apps/api/src/db/setup.ts`
- Modify: `apps/api/package.json`
- Modify: `package.json`
- Test: `apps/api/tests/migration-runner.test.ts`

**Interfaces:**
- Consumes: `db`, `withTransaction`, `database/migrations`, and `database/seeds`.
- Produces: `pnpm db:migrate`, `pnpm db:seed`, and `pnpm db:setup`; migration runner returns applied versions and never records failed files.

- [ ] **Step 1: Write failing runner tests**

Use a fake pool/client and temporary SQL directories to test sorted file discovery, already-applied version skipping, successful version recording, rollback on SQL failure, client release, and ordered seed execution.

- [ ] **Step 2: Run the focused runner tests and verify the expected failure**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/migration-runner.test.ts`

Expected: FAIL because the runner modules do not exist yet.

- [ ] **Step 3: Implement the runners and workspace commands**

Use a single checked-out client per migration transaction, create `schema_migrations` before reading applied versions, sort SQL filenames lexically, record the filename only after commit, and release clients in every path. Run seeds explicitly without dropping data. Wire root workspace scripts through the API package's `tsx` commands.

- [ ] **Step 4: Run focused and repository verification**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/migration-runner.test.ts` and then `pnpm test -- --run`.

Expected: runner tests and the complete workspace suite pass.

---

### Task 4: Documentation and final branch verification

**Files:**
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `database/README.md`
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/ERD.md`

**Interfaces:**
- Consumes: the implemented migration and seed commands.
- Produces: accurate local setup, Docker database, migration, seed, health, and verification instructions for the next developer.

- [ ] **Step 1: Update documentation**

Document `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:setup`, `/health/db`, deterministic seed identities, and the fact that database-backed commands require a reachable PostgreSQL instance.

- [ ] **Step 2: Run final verification**

Run: `pnpm typecheck`, `pnpm lint`, `pnpm test -- --run`, `pnpm build`, `pnpm format:check`, and `docker compose config` when Docker is available.

Expected: all local checks exit 0; Docker Compose configuration is valid; no real secrets are added.

- [ ] **Step 3: Stop for the user's manual Git checkpoint**

Do not commit or push. Report the changed files, verification results, and:

```text
Commit: feat(db): add PostgreSQL schema and migration tooling
```
