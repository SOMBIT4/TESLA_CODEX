# Tesla Pooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an online driver accept a requested ride into one compatible pool without exceeding the active vehicle's capacity.

**Architecture:** Add a forward-only pool matching migration and a `modules/pools` route → controller → service → repository slice. The service calculates the deterministic pooled fare, while the repository executes the lock-sensitive acceptance transaction through the existing `withTransaction` helper. The driver-facing HTTP route delegates to that slice and returns only the created/reused pool and membership summary.

**Tech Stack:** Node.js 24, TypeScript, Express 5, PostgreSQL 16 with `pg`, Vitest, Supertest, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-26-tesla-pooling-design.md`

## Global Constraints

- Work only on `feature/tesla-pooling`; the user performs all Git staging, commits, pushes, PR creation, and merges.
- Add a new numbered migration; do not alter migrations `001`–`009`.
- A driver has at most one active pool. A pool is compatible only when its stored pickup zone equals the requested ride pickup zone; destinations may differ.
- The accept endpoint is `POST /api/driver/requests/:rideId/accept`, requires an authenticated `DRIVER`, and accepts no body.
- Lock driver, ride, and pool state inside a single PostgreSQL transaction before checking capacity or inserting a membership.
- Final membership fare uses `calculateFare(pickupZone, destinationZone, seatsRequested, true)` and is stored in integer poysha.
- The operation atomically creates/reuses a pool, inserts one `ACTIVE` membership, changes the ride from `REQUESTED` to `MATCHED`, and appends a status event.
- Do not add lifecycle actions, pool details/manifests, driver history, frontend UI, route optimization, or advanced matching.
- Keep `pnpm test` database-free. Add a separate Docker-backed `pnpm test:db` command for the capacity race test.

## Review Focus

- Two concurrent claims for one final seat must result in exactly one success and an active reserved-seat total equal to—not above—capacity; Task 4 adds a real PostgreSQL test.
- A concurrent second acceptance of the same ride must not create two memberships; Task 2 locks the ride and maps the second result to `RIDE_ALREADY_MATCHED`, and Task 3 tests it through the API.
- An offline driver or a driver without an active vehicle must be rejected at transaction time, even if they saw a waiting ride earlier; Task 2 covers service outcomes and Task 3 covers HTTP errors.
- A driver with an active pool for a different pickup zone must not receive a second pool; Task 2 checks the incompatibility outcome and Task 3 pins the `409 RIDE_NOT_COMPATIBLE` response.
- The success response must not leak passenger name, email, or passenger ID; Task 3 asserts the exact response projection.

---

### Task 1: Pool matching schema contract

**Files:**
- Create: `database/migrations/010_add_pool_matching_constraints.sql`
- Modify: `apps/api/tests/schema-files.test.ts`
- Modify: `database/README.md`

**Interfaces:**
- Consumes: existing `pools`, `ride_requests`, and `vehicles` schema from migrations `003`–`009`.
- Produces: `pools.pickup_zone` and `uq_pools_driver_active`, used by the pool repository.

- [ ] **Step 1: Write failing schema-file assertions**

Extend the expected migration list with `010_add_pool_matching_constraints.sql`. Add assertions for a non-null `pickup_zone` constrained to the existing Dhaka zones, and for a unique partial index on `pools(driver_id)` whose active statuses are `MATCHED`, `DRIVER_ARRIVED`, and `STARTED`.

- [ ] **Step 2: Run the schema test and verify RED**

Run:

```powershell
pnpm --filter @dhaka-tesla-pool/api test -- --run tests/schema-files.test.ts
```

Expected: FAIL because migration `010` does not exist.

- [ ] **Step 3: Create migration `010_add_pool_matching_constraints.sql`**

Add `pickup_zone VARCHAR(50) NOT NULL` with the same allowed area values as `ride_requests`, then create:

```sql
CREATE UNIQUE INDEX uq_pools_driver_active
    ON pools(driver_id)
    WHERE status IN ('MATCHED', 'DRIVER_ARRIVED', 'STARTED');
```

Use a forward-only migration. No existing pool-writing API exists before this feature, so no data backfill is required at this project milestone.

- [ ] **Step 4: Document migration order and verify GREEN**

Update `database/README.md` to include both existing migration `009` and new migration `010`. Re-run the schema test; expected PASS.

- [ ] **Step 5: User Git checkpoint**

Stop and ask the user to inspect and commit only the migration, schema-file test, and database README with:

```text
feat(db): add pool matching constraints
```

### Task 2: Transactional pool domain and repository

**Files:**
- Create: `apps/api/src/modules/pools/pool.types.ts`
- Create: `apps/api/src/modules/pools/pool.repository.ts`
- Create: `apps/api/src/modules/pools/pool.service.ts`
- Create: `apps/api/tests/pool.repository.test.ts`
- Create: `apps/api/tests/pool.service.test.ts`

**Interfaces:**
- Consumes: `calculateFare`, `RideStatus`, `AppError`, `withTransaction`, and Task 1's `pools.pickup_zone`/unique index.
- Produces: `PoolService.acceptRide(driverUserId, rideId)` and `PoolRepository.acceptRide(input)` for the HTTP boundary.

- [ ] **Step 1: Write failing service and repository tests**

Define and test the following public interfaces:

```ts
interface PoolService {
  acceptRide(driverUserId: string, rideId: string): Promise<PoolAcceptance>;
}

interface PoolRepository {
  acceptRide(
    input: AcceptRideInput,
    calculatePooledFare: (ride: PoolRideForFare) => number,
  ): Promise<PoolAcceptanceOutcome>;
}
```

`PoolRideForFare` includes `id`, `status`, `pickupZone`, `destinationZone`, and `seatsRequested`. `AcceptRideInput` contains the authenticated driver user ID, ride ID, and generated pool/membership/status-event IDs.

Cover first-pool creation, same-pickup pool reuse, `Banani → Mohakhali` pooled fare `7100`, `Banani → Gulshan 1` pooled fare `5900`, status-event insertion, `POOL_FULL`, `RIDE_ALREADY_MATCHED`, `RIDE_NOT_COMPATIBLE`, offline driver, no vehicle, missing driver profile, and missing ride. Repository SQL tests must assert the driver, ride, and existing-pool lock queries use `FOR UPDATE`; the membership-seat sum filters `ACTIVE`; and all SQL values are parameterized.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
pnpm --filter @dhaka-tesla-pool/api test -- --run tests/pool.repository.test.ts tests/pool.service.test.ts
```

Expected: FAIL because `modules/pools` does not exist.

- [ ] **Step 3: Implement types, transaction outcomes, repository, and service**

In `pool.types.ts`, define `PoolStatus`, `PoolSummary`, `PoolMembershipSummary`, `PoolAcceptance`, `PoolRideForFare`, `AcceptRideInput`, and a discriminated `PoolAcceptanceOutcome` covering `accepted`, `driver_profile_missing`, `driver_offline`, `no_active_vehicle`, `ride_not_found`, `ride_not_requested`, `ride_not_compatible`, and `pool_full`. `AcceptRideInput` contains only identity and generated record IDs; it does not include a fare.

Implement `PoolRepository` with `withTransaction`. The transaction must lock the driver row, lock the requested ride, call the supplied synchronous fare calculator with the locked ride, inspect the driver's active pool, create a `MATCHED` pool only when the driver has no active pool, lock the reusable pool, calculate occupied `ACTIVE` seats, and insert the membership, ride update, and event before returning the pool/membership summary. A driver with an active pool for another pickup returns `ride_not_compatible`; the repository must never create a second active pool.

Implement `PoolService.acceptRide` by generating UUIDs with `randomUUID()`, delegating to `acceptRide`, and supplying a synchronous callback that calls `calculateFare(ride.pickupZone, ride.destinationZone, ride.seatsRequested, true)`. Map every repository outcome to the specified `AppError` code/status.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Task 2 test command. Expected: PASS.

- [ ] **Step 5: User Git checkpoint**

Stop and ask the user to inspect and commit the new pool module and its focused tests with:

```text
feat(pool): enforce transactional ride acceptance
```

### Task 3: Driver acceptance HTTP endpoint

**Files:**
- Create: `apps/api/src/modules/pools/pool.controller.ts`
- Create: `apps/api/src/modules/pools/pool.routes.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/index.ts`
- Create: `apps/api/tests/pool.integration.test.ts`

**Interfaces:**
- Consumes: Task 2 `PoolService.acceptRide`, the existing authentication/role middleware, and the shared error envelope.
- Produces: `POST /api/driver/requests/:rideId/accept` returning `201 { data: { pool, membership } }`.

- [ ] **Step 1: Write failing endpoint integration tests**

Use injected in-memory pool repository outcomes and signed JWT cookies. Assert:

- missing session returns `401 UNAUTHENTICATED`;
- passenger session returns `403 FORBIDDEN`;
- a driver creates a first pool with `status: "MATCHED"`, `pickupZone`, `capacity`, `occupiedSeats`, and `availableSeats`;
- a compatible second ride returns the same pool ID and increased occupancy;
- each domain outcome from Task 2 returns its documented status/code;
- the `201` payload includes only pool and membership fields, never passenger ID, name, or email.

- [ ] **Step 2: Run endpoint test and verify RED**

Run:

```powershell
pnpm --filter @dhaka-tesla-pool/api test -- --run tests/pool.integration.test.ts
```

Expected: FAIL because the acceptance route is absent.

- [ ] **Step 3: Implement the HTTP boundary and wiring**

Add `createPoolController(poolService)` and `createPoolRouter(poolService)`. Mount its driver-only accept route at the API root so its full path is `/api/driver/requests/:rideId/accept`. Add optional `poolService?: PoolService` dependency injection to `createApp` and a fourth optional `PoolService` parameter to `createApiRouter`.

The controller passes only `request.user.userId` and `request.params.rideId` to the service, returns `201` for acceptance, and serializes exactly the public pool/membership summary from Task 2.

- [ ] **Step 4: Run endpoint test and verify GREEN**

Run the Task 3 test command. Expected: PASS.

- [ ] **Step 5: User Git checkpoint**

Stop and ask the user to inspect and commit the route/controller/wiring/integration test with:

```text
feat(pool): add driver ride acceptance endpoint
```

### Task 4: Docker-backed concurrency verification

**Files:**
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Create: `apps/api/tests/pool.db.integration.ts`

**Interfaces:**
- Consumes: the Task 2 real PostgreSQL-backed `PoolService`, an explicit `POOL_TEST_DATABASE_URL`, and the completed migrations/seeds.
- Produces: `pnpm test:db`, which runs only the real database concurrency test and never runs during default `pnpm test`.

- [ ] **Step 1: Write the real database final-seat test**

Create `pool.db.integration.ts` (without the `.test.ts` suffix so Vitest's default test discovery does not load it). Require `POOL_TEST_DATABASE_URL` at runtime with a clear failure message; before dynamically importing application modules, assign that value to `process.env.DATABASE_URL` so the application database pool cannot fall back to its default connection. Create isolated UUID-based users, driver, active vehicle with capacity `3`, and requested rides; use one two-seat accepted ride to establish the pool, then concurrently accept two same-pickup one-seat rides with `Promise.allSettled`.

Assert exactly one final-seat acceptance fulfills, one rejects with `POOL_FULL`, active reserved seats total `3`, and no ride has more than one membership. Clean up created events, memberships, pools, rides, vehicles, drivers, and users in reverse dependency order in `afterEach`/`afterAll`.

- [ ] **Step 2: Add explicit database test scripts**

Add `test:db` to the API package as:

```text
vitest --run tests/pool.db.integration.ts
```

Add root `test:db` forwarding to `@dhaka-tesla-pool/api`. The user must set `POOL_TEST_DATABASE_URL`, run `pnpm db:setup` against the same database, then run `pnpm test:db`; a missing test URL must fail rather than silently skip the concurrency test.

- [ ] **Step 3: Run test-db check and verify RED/GREEN**

First run `pnpm test:db` with no `POOL_TEST_DATABASE_URL`; expected: a clear configuration failure. Then start Docker, set both `DATABASE_URL` and `POOL_TEST_DATABASE_URL` to the same local database, run `pnpm db:setup`, and run `pnpm test:db`; expected: PASS with the final seat total equal to `3`.

- [ ] **Step 4: User Git checkpoint**

Stop and ask the user to inspect and commit the scripts and database concurrency test with:

```text
test(pool): verify concurrent final-seat claims
```

### Task 5: Documentation and complete verification

**Files:**
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `apps/api/tests/auth-documentation.test.ts`
- Modify: `docs/superpowers/specs/2026-09-26-tesla-pooling-design.md`
- Create: `docs/superpowers/plans/2026-09-26-tesla-pooling.md`

**Interfaces:**
- Consumes: the endpoint, migration, `test:db` command, and accepted behavior from Tasks 1–4.
- Produces: accurate manual setup/API documentation and a clear next feature branch.

- [ ] **Step 1: Write failing documentation assertions**

Extend `auth-documentation.test.ts` (or rename it only if necessary) to require `POST /api/driver/requests/:rideId/accept`, `pnpm test:db`, the pool capacity rule, and the selected next branch name. Do not expose database passwords, JWT secrets, or internal passenger data.

- [ ] **Step 2: Run documentation test and verify RED**

Run:

```powershell
pnpm --filter @dhaka-tesla-pool/api test -- --run tests/auth-documentation.test.ts
```

Expected: FAIL until the pooling behavior is documented.

- [ ] **Step 3: Document the feature**

Update README and project status with the accept endpoint, same-pickup compatibility, one-active-pool rule, capacity guarantee, pooled-fare storage, and local `test:db` prerequisites. Update the current milestone and select the next branch only after confirming it with the user. Keep the spec and plan in the documentation checkpoint, but do not stage or commit them; the user controls all Git actions.

- [ ] **Step 4: Run focused and full verification**

Run:

```powershell
pnpm --filter @dhaka-tesla-pool/api test -- --run tests/auth-documentation.test.ts
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm format:check
```

With Docker Desktop running, set `DATABASE_URL` and `POOL_TEST_DATABASE_URL` to the same local database, then run:

```powershell
pnpm db:setup
pnpm test:db
```

Report unrelated pre-existing format warnings separately; do not change unrelated files.

- [ ] **Step 5: User Git checkpoint**

Stop and ask the user to inspect and commit the documentation with:

```text
docs(pool): document transactional ride pooling
```
