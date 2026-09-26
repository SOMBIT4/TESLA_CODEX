# Driver Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe, driver-only availability dashboard with a first-load snapshot and a privacy-safe waiting-ride list.

**Architecture:** Add one schema migration and a `modules/driver` route → controller → service → repository slice. The service resolves the authenticated driver's profile, uses an atomic conditional status update to preserve the active-vehicle rule, and exposes only a bounded projection of waiting rides.

**Tech Stack:** Node.js 24, TypeScript, Express 5, Zod, PostgreSQL with raw `pg`, Vitest, Supertest, pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-09-26-driver-flow-design.md`

## Global Constraints

- Work on `feature/driver-flow`; use incremental local commits and merge locally to `master` only after final verification passes. Do not push.
- Add a new numbered migration; never modify a previously-applied migration.
- Add `drivers.updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` and a partial unique index enforcing one active vehicle per driver.
- All driver endpoints require existing `requireAuth` plus `requireRole("DRIVER")` middleware.
- Going online must use one conditional SQL update which checks for an active vehicle at write time and sets `updated_at`; going offline remains allowed with no vehicle.
- Preserve `404 DRIVER_PROFILE_NOT_FOUND`, use `409 NO_ACTIVE_VEHICLE` for a known driver whose online transition cannot update, and use the shared validation envelope for malformed status input.
- Return only `REQUESTED` rides ordered by `created_at ASC, id ASC`, with a hard limit of 50 and no passenger identity fields.
- Do not add history, pool creation, matching, membership, capacity allocation, fares, or ride-state transitions.

## Review Focus

- A missing session must receive `401 UNAUTHENTICATED` from `GET /me`, `POST /status`, and `GET /requests` rather than an accidental route-level response.
- A passenger token must receive `403 FORBIDDEN` from all driver endpoints.
- An existing driver without a vehicle cannot transition online and remains offline after the `409 NO_ACTIVE_VEHICLE` response.
- A driver-role user with no `drivers` row must receive `404 DRIVER_PROFILE_NOT_FOUND`, not be treated as a vehicle failure.
- Waiting requests must omit passenger ID, name, and email; they must filter to `REQUESTED`, be oldest-first, and never exceed 50 records.

### Task 1: Driver availability schema constraint

**Files:**
- Create: `database/migrations/009_add_driver_availability_constraints.sql`
- Modify: `apps/api/tests/schema-files.test.ts`

**Interfaces:**
- Consumes: `drivers` and `vehicles` created by migrations `002` and `003`.
- Produces: `drivers.updated_at` and the `uq_vehicles_active_driver` partial unique index required by the driver repository.

- [ ] **Step 1: Write the failing schema-file assertions**

Extend the documented migration list with `009_add_driver_availability_constraints.sql`. Assert that it adds `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` to `drivers` and creates a unique partial index on `vehicles(driver_id)` with `WHERE is_active`.

- [ ] **Step 2: Run the schema-file test and verify RED**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/schema-files.test.ts`

Expected: FAIL because migration `009` does not exist.

- [ ] **Step 3: Add the new migration**

Create `009_add_driver_availability_constraints.sql` with:

```sql
ALTER TABLE drivers
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX uq_vehicles_active_driver
    ON vehicles(driver_id)
    WHERE is_active;
```

- [ ] **Step 4: Run the schema-file test and verify GREEN**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/schema-files.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the schema contract**

```powershell
git add database/migrations/009_add_driver_availability_constraints.sql apps/api/tests/schema-files.test.ts
git commit -m "feat(db): constrain active driver vehicles"
```

### Task 2: Driver domain, repository, and availability service

**Files:**
- Create: `apps/api/src/modules/driver/driver.types.ts`
- Create: `apps/api/src/modules/driver/driver.schema.ts`
- Create: `apps/api/src/modules/driver/driver.repository.ts`
- Create: `apps/api/src/modules/driver/driver.service.ts`
- Create: `apps/api/tests/driver.repository.test.ts`
- Create: `apps/api/tests/driver.service.test.ts`

**Interfaces:**
- Consumes: `drivers.updated_at`, the `uq_vehicles_active_driver` constraint, `RideStatus`, `AppError`, and `z`.
- Produces: `DriverSnapshot`, `WaitingRide`, `driverStatusSchema`, `DriverRepository`, `createDriverRepository()`, and `DriverService` for the HTTP boundary.

- [ ] **Step 1: Write failing domain/repository/service tests**

Write tests for the following desired interfaces:

```ts
interface DriverService {
  getSnapshot(userId: string): Promise<DriverSnapshot>;
  setOnlineStatus(userId: string, isOnline: boolean): Promise<DriverSnapshot>;
  listWaitingRides(userId: string): Promise<WaitingRide[]>;
}
```

Cover a valid boolean status payload, a driver snapshot with Bullet, a missing profile returning `DRIVER_PROFILE_NOT_FOUND`, online-without-vehicle returning `NO_ACTIVE_VEHICLE` while in-memory `isOnline` remains `false`, and offline-without-vehicle succeeding. Repository tests must assert the requests query filters `REQUESTED`, orders `created_at ASC, id ASC`, limits 50, and selects no passenger data.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/driver.repository.test.ts tests/driver.service.test.ts`

Expected: FAIL because the driver module does not exist.

- [ ] **Step 3: Implement the driver domain and data access**

Define `DriverVehicle`, `DriverSnapshot`, and `WaitingRide` types. Make `driverStatusSchema` accept only `{ isOnline: z.boolean() }`.

In `driver.repository.ts`, implement:

- `findSnapshot(userId)` using `drivers.user_id = $1` and a left join to the driver's active vehicle;
- `setOnlineStatusIfAllowed(userId, isOnline)` as one `UPDATE drivers AS d` with `SET is_online = $2::boolean, updated_at = NOW()` and `AND ($2::boolean = FALSE OR EXISTS (... vehicles ... is_active = TRUE))`; return the snapshot through a CTE so `POST /status` does not need a second status update;
- `listRequestedRides()` selecting only `id`, route zones, seats, fare, and timestamp, with `WHERE status = 'REQUESTED' ORDER BY created_at ASC, id ASC LIMIT 50`.

In `driver.service.ts`, resolve the profile before every operation so a missing driver remains a `404` for snapshot loading, status updates, and waiting-request reads. Convert a null online update for an existing profile into `409 NO_ACTIVE_VEHICLE`; return a successful offline snapshot even without a vehicle.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/driver.repository.test.ts tests/driver.service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the driver domain**

```powershell
git add apps/api/src/modules/driver/driver.types.ts apps/api/src/modules/driver/driver.schema.ts apps/api/src/modules/driver/driver.repository.ts apps/api/src/modules/driver/driver.service.ts apps/api/tests/driver.repository.test.ts apps/api/tests/driver.service.test.ts
git commit -m "feat(driver): add availability service"
```

### Task 3: Driver HTTP endpoints and authorization

**Files:**
- Create: `apps/api/src/modules/driver/driver.controller.ts`
- Create: `apps/api/src/modules/driver/driver.routes.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/index.ts`
- Create: `apps/api/tests/driver.integration.test.ts`

**Interfaces:**
- Consumes: `DriverService`, `driverStatusSchema`, `validateBody`, `requireAuth`, and `requireRole("DRIVER")`.
- Produces: `GET /api/driver/me`, `POST /api/driver/status`, and `GET /api/driver/requests` with the shared JSON envelope.

- [ ] **Step 1: Write failing HTTP integration tests**

Use an in-memory `DriverRepository` and signed JWT cookies. Cover:

- no session gets `401 UNAUTHENTICATED` on all three routes;
- a passenger token gets `403 FORBIDDEN` on all three routes;
- `GET /me` and a successful status update return the exact `{ data: { isOnline, vehicle } }` shape;
- invalid status payload gets `400 VALIDATION_ERROR`;
- a driver-role user without a profile gets `404 DRIVER_PROFILE_NOT_FOUND` on all three routes;
- a no-vehicle driver gets `409 NO_ACTIVE_VEHICLE` when going online, remains offline, and succeeds when going offline;
- requests contain only `REQUESTED` data in oldest-first order, are capped at 50, and include no `passengerId`, `name`, or `email` fields.

- [ ] **Step 2: Run focused integration tests and verify RED**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/driver.integration.test.ts`

Expected: FAIL because `/api/driver` routes do not exist.

- [ ] **Step 3: Implement the HTTP boundary and application wiring**

Add controllers that read only `request.user.userId`, serialize the two documented response shapes, and forward errors to the shared middleware. Mount the router under `/api/driver` after applying `requireAuth` and `requireRole("DRIVER")` to every driver route. Add optional `driverService` injection to `createApp()` and `createApiRouter()` for integration testing.

- [ ] **Step 4: Run focused integration tests and verify GREEN**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/driver.integration.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the API endpoints**

```powershell
git add apps/api/src/modules/driver/driver.controller.ts apps/api/src/modules/driver/driver.routes.ts apps/api/src/app.ts apps/api/src/routes/index.ts apps/api/tests/driver.integration.test.ts
git commit -m "feat(driver): add availability endpoints"
```

### Task 4: Documentation, final verification, and local merge

**Files:**
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `apps/api/tests/auth-documentation.test.ts`
- Create: `docs/superpowers/specs/2026-09-26-driver-flow-design.md`
- Create: `docs/superpowers/plans/2026-09-26-driver-flow.md`

**Interfaces:**
- Consumes: completed driver API and documented branch workflow.
- Produces: accurate endpoint documentation, a manual test path, and local integration into `master`.

- [ ] **Step 1: Write failing documentation assertions**

Extend the documentation test to require `GET /api/driver/me`, `POST /api/driver/status`, `GET /api/driver/requests`, and a project-status next branch of `feature/tesla-pooling`.

- [ ] **Step 2: Run the documentation test and verify RED**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/auth-documentation.test.ts`

Expected: FAIL because the new driver endpoints and milestone have not yet been documented.

- [ ] **Step 3: Document the driver flow**

Describe the three driver-only endpoints, active-vehicle rule, 50 oldest waiting-request limit, and privacy boundary. Update the current milestone and checkpoint to `feature/driver-flow`; name `feature/tesla-pooling` as the next branch.

- [ ] **Step 4: Run targeted and full verification**

Run:

```powershell
pnpm --filter @dhaka-tesla-pool/api test -- --run tests/auth-documentation.test.ts
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Expected: all commands pass. Run the repository formatter separately and report pre-existing unrelated formatting warnings without modifying those files.

- [ ] **Step 5: Commit documentation and merge locally**

```powershell
git add README.md docs/PROJECT_STATUS.md apps/api/tests/auth-documentation.test.ts docs/superpowers/specs/2026-09-26-driver-flow-design.md docs/superpowers/plans/2026-09-26-driver-flow.md
git commit -m "docs(driver): document availability flow"
git switch master
git merge --no-ff feature/driver-flow
pnpm test
```

Expected: the merge succeeds and the full test suite remains green on `master`. Do not push; leave `master` checked out for the user to inspect.
