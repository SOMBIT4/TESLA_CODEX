# Per-Rider Drop-Off Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add transactional per-rider drop-off, automatic final pool completion, completion timestamps, and the supporting driver/passenger behavior without allowing capacity or lifecycle races.

**Architecture:** Keep the existing route → controller → service → repository → PostgreSQL vertical slice. A pure occupancy helper defines a seat as occupied when the membership is `ACTIVE` and the linked ride status is not `COMPLETED`; acceptance, active-pool reads, and drop-off responses all use that rule. Drop-off locks the driver, owned pool, and all active membership/ride rows, completes one ride, and completes the pool only when no occupied member remains.

**Tech Stack:** Node.js, TypeScript, Express 5, PostgreSQL via `pg`, Vitest, Supertest, React, Next.js, Tailwind, and the existing shadcn-style components.

**Spec:** `docs/superpowers/specs/2026-09-29-per-rider-dropoff-design.md`

## Global Constraints

- Create `database/migrations/011_add_ride_completion_timestamp.sql`; never edit an older migration.
- Backfill existing `COMPLETED` rides from their completed pool's `completed_at` before adding the status/timestamp check.
- Define occupied seats as `pool_memberships.status = 'ACTIVE'` with linked ride status not equal to `COMPLETED`.
- A drop-off is allowed only for a driver's own `STARTED` pool and an active member ride in `STARTED`.
- Started pools may contain both `STARTED` and `COMPLETED` member rides.
- Drop-off never updates `pool_memberships.fare_poysha`.
- The lock order is driver row → owned pool row → active memberships and ride rows.
- The old pool-level complete route returns `409 POOL_COMPLETION_REQUIRES_DROPOFF` without a repository call or database write.
- Driver responses never include passenger email, passenger ID, or other passenger identity beyond the already-approved active-pool passenger name.
- The user alone stages, commits, pushes, and merges. The agent must not run Git-mutating commands.
- Backend, driver UI, and passenger UI are separate manual commit checkpoints.

## Review Focus

- Two `MATCHED` one-seat rides must occupy two seats, so a later two-seat request is rejected; the final-seat concurrency test must remain green.
- A completed member must disappear from the active-pool member list and stop counting toward seats while the remaining started member still keeps the pool active.
- Two concurrent drop-offs must serialize and cannot create duplicate completion events or complete the pool twice.
- A legacy completed ride without a completed pool timestamp must not receive a fabricated timestamp; the migration check must expose inconsistent data.
- A driver must not drop a ride from another driver's pool, and a passenger must not gain a driver-only drop-off route.

---

### Task 1: Add completion timestamp migration and API read mapping

**Files:**

- Create: `database/migrations/011_add_ride_completion_timestamp.sql`
- Modify: `apps/api/src/modules/rides/ride.types.ts`
- Modify: `apps/api/src/modules/rides/ride.repository.ts`
- Modify: `apps/api/src/modules/rides/ride.controller.ts`
- Test: `apps/api/tests/schema-files.test.ts`
- Test: `apps/api/tests/ride.repository.test.ts`
- Test: `apps/api/tests/ride.integration.test.ts`

**Interfaces:**

- Produces `RideRecord.completedAt: Date | string | null`.
- Produces API `completedAt` on ride create, list, and detail responses.
- Produces migration 011 with the backfill and
  `CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL))`.

- [x] **Step 1: Write failing migration and ride-read tests**

Assert that the migration file adds `completed_at`, backfills from
`pools.completed_at` through `pool_memberships`, and adds the exact status
check. Add repository/controller coverage proving a non-completed ride maps
`completedAt` to `null` and a completed ride exposes its timestamp.

- [x] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
pnpm --filter @dhaka-tesla-pool/api test -- --run tests/schema-files.test.ts tests/ride.repository.test.ts tests/ride.integration.test.ts
```

Expected: failures because migration 011 and the completed timestamp mapping do
not exist.

- [x] **Step 3: Implement migration 011 and ride mapping**

Add the nullable column, the completed-pool backfill restricted to existing
`COMPLETED` rides, and the final check constraint. Extend the shared ride
column list, row mapper, domain record, and controller response. Do not use a
`NOW()` fallback for historical rows.

- [x] **Step 4: Run the focused tests and verify GREEN**

Run the same command from Step 2. Expected: PASS.

---

### Task 2: Centralize occupied-seat semantics and protect acceptance capacity

**Files:**

- Modify: `apps/api/src/modules/pools/pool.types.ts`
- Modify: `apps/api/src/modules/pools/pool.repository.ts`
- Test: `apps/api/tests/pool.types.test.ts`
- Test: `apps/api/tests/pool.repository.test.ts`
- Test: `apps/api/tests/pool.db.integration.ts`

**Interfaces:**

- Produces a pure `countsTowardOccupiedSeats(membershipStatus, rideStatus): boolean` helper.
- The helper returns `true` only for an `ACTIVE` membership whose ride status
  is not `COMPLETED`.
- Acceptance, active-pool mapping, and drop-off summary calculations consume
  the same helper.

- [x] **Step 1: Write failing occupancy and capacity tests**

Test the helper for `MATCHED`, `DRIVER_ARRIVED`, and `STARTED` active rides,
`COMPLETED` active rides, and non-active memberships. Add a repository/DB
regression with two matched one-seat riders in a three-seat Bullet and a
two-seat request; expect `pool_full` and no new membership or status event.
Add an active-pool read regression proving a completed member is omitted while
matched members remain visible. Keep the existing final-seat concurrency test
unchanged.

- [x] **Step 2: Run occupancy and acceptance tests and verify RED**

Run:

```powershell
pnpm --filter @dhaka-tesla-pool/api test -- --run tests/pool.types.test.ts tests/pool.repository.test.ts
```

Expected: the new helper and completed-member filtering tests fail because the
shared rule and active-pool filtering do not exist yet. The matched-capacity
regression may already pass through the current row count; it remains as a
regression proving that the shared implementation cannot reduce pre-start
occupancy.

- [x] **Step 3: Implement the shared occupancy rule**

Add the pure helper and include membership status plus ride status in the
repository rows needed for calculations. Filter completed members from the
active-pool representation, calculate acceptance occupancy through the helper,
and preserve all non-completed `MATCHED`/`DRIVER_ARRIVED`/`STARTED` seats.

- [x] **Step 4: Run focused and database tests and verify GREEN**

Run:

```powershell
pnpm --filter @dhaka-tesla-pool/api test -- --run tests/pool.types.test.ts tests/pool.repository.test.ts
pnpm test:db
```

The database command requires `POOL_TEST_DATABASE_URL`; expected results are
the new matched-capacity rejection and the existing final-seat race passing.

---

### Task 3: Implement the transactional drop-off repository operation

**Files:**

- Modify: `apps/api/src/modules/pools/pool.types.ts`
- Modify: `apps/api/src/modules/pools/pool.repository.ts`
- Test: `apps/api/tests/pool.repository.test.ts`
- Test: `apps/api/tests/pool.db.integration.ts`

**Interfaces:**

- Add `DropOffRideInput` with `driverUserId`, `poolId`, and `rideId`.
- Add `PoolDropOffOutcome` variants for success, missing driver profile, pool
  not found, invalid pool state, missing ride, ride not ready, and member-state
  mismatch.
- Add `dropOffRide(input, createStatusEventId)` to `PoolRepository`.
- A successful result returns the updated pool summary, the dropped ride ID,
  and the ride `completedAt` timestamp.

- [x] **Step 1: Write failing repository tests**

Cover:

1. driver → pool → membership/ride query order;
2. Rafiq dropped first, only Rafiq updated, pool remains `STARTED`, one event,
   and occupancy becomes `1` with `2` seats available;
3. Nusrat dropped last, the pool becomes `COMPLETED` with `completed_at`;
4. drop-off before start returns an invalid pool outcome with no writes;
5. dropping an already completed rider returns `ride_not_started` with no
   second event;
6. another driver's pool returns `pool_not_found`;
7. an unexpected member state returns `pool_ride_state_mismatch` without
   partial writes; and
8. membership fares are identical before and after all drop-offs.

- [x] **Step 2: Run repository tests and verify RED**

Run:

```powershell
pnpm --filter @dhaka-tesla-pool/api test -- --run tests/pool.repository.test.ts
```

Expected: FAIL because the drop-off input, outcome, repository method, and
completion timestamp update do not exist.

- [x] **Step 3: Implement `dropOffRide`**

Within `runInTransaction`, lock the driver, owned pool, and all active
membership/ride rows in that order. Allow mixed `STARTED`/`COMPLETED` member
states, require the target ride to be `STARTED`, update only the target ride
with `completed_at = NOW()`, insert one status event, and update the pool only
when no occupied member remains. Compute returned occupancy through the shared
helper and never update fare columns.

- [x] **Step 4: Run repository and real PostgreSQL tests and verify GREEN**

Run the focused repository command and:

```powershell
pnpm test:db
```

Expected: partial and final drop-off tests pass, including timestamps,
occupancy, fare immutability, and the completion constraint.

---

### Task 4: Expose drop-off and reject pool-level completion through the API

**Files:**

- Modify: `apps/api/src/modules/pools/pool.service.ts`
- Modify: `apps/api/src/modules/pools/pool.controller.ts`
- Modify: `apps/api/src/modules/pools/pool.routes.ts`
- Modify: `apps/api/tests/pool.service.test.ts`
- Modify: `apps/api/tests/pool.integration.test.ts`
- Modify: `apps/api/tests/auth-documentation.test.ts`

**Interfaces:**

- Add `PoolService.dropOffRide(driverUserId, poolId, rideId)`.
- Add `POST /api/driver/pools/:poolId/rides/:rideId/drop-off`.
- Keep `POST /api/driver/pools/:poolId/complete` as a no-write compatibility
  response with `409 POOL_COMPLETION_REQUIRES_DROPOFF`.

- [x] **Step 1: Write failing service and HTTP tests**

Add service outcome mapping tests and HTTP coverage for no session (`401`),
passenger (`403`), another driver's pool (`404`), before-start rejection,
successful partial and final drop-off responses, repeated drop-off, fare
privacy, and the deprecated complete route's `409` response.

- [x] **Step 2: Run service and integration tests and verify RED**

Run:

```powershell
pnpm --filter @dhaka-tesla-pool/api test -- --run tests/pool.service.test.ts tests/pool.integration.test.ts
```

Expected: FAIL because the service method and route do not exist.

- [x] **Step 3: Implement service, controller, and routes**

Map repository outcomes to stable `AppError` values, generate one event ID per
successful drop-off, serialize the privacy-safe response, and keep the old
complete route as an explicit rejection that never calls the repository.

- [x] **Step 4: Run backend focused tests and verify GREEN**

Run the same command from Step 2 plus the complete API test suite. Expected:
all backend tests pass.

---

### Task 5: Document and verify the backend checkpoint

**Files:**

- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/superpowers/specs/2026-09-29-per-rider-dropoff-design.md`

- [x] **Step 1: Update backend API and lifecycle documentation**

Document the drop-off route, shared occupied-seat rule, completion timestamp,
mixed started/completed pool members, rejected pool-level completion, and the
backend-first commit checkpoint. State that passenger history will display the
completion time beside `Completed` in the later passenger UI checkpoint.

- [x] **Step 2: Run backend verification**

Run:

```powershell
pnpm --filter @dhaka-tesla-pool/api test
pnpm --filter @dhaka-tesla-pool/api lint
pnpm --filter @dhaka-tesla-pool/api build
pnpm db:setup
pnpm test:db
git diff --check
```

Expected: all backend tests, TypeScript checks, build, real database tests,
and whitespace validation pass. Prettier repository-wide remains a separate
baseline issue and must not cause unrelated formatting rewrites.

- [x] **Step 3: Stop for the user's manual backend commit**

Do not stage, commit, push, or merge. Report the exact backend file list and
provide:

```text
feat(pool): add per-rider drop-off lifecycle
```

The user manually commits and pushes this backend checkpoint before the driver
UI work begins.

---

### Task 6: Add driver drop-off controls

**Files:**

- Modify: `apps/web/src/lib/api/types.ts`
- Modify: `apps/web/src/lib/api/driver.ts`
- Modify: `apps/web/src/hooks/use-driver-dashboard.ts`
- Modify: `apps/web/src/components/driver/active-pool-card.tsx`
- Modify: `apps/web/src/components/driver/driver-dashboard.tsx`
- Test: `apps/web/tests/driver-api.test.ts`
- Test: `apps/web/tests/use-driver-dashboard.test.tsx`
- Test: `apps/web/tests/driver-dashboard.test.tsx`

- [ ] **Step 1: Write failing driver UI tests**

Assert the exact drop-off URL, pending serialization, per-member button only
after `STARTED`, disabled controls during a drop-off, removal of the old
complete action, and refresh after partial/final drop-off.

- [ ] **Step 2: Implement the driver API and dashboard action**

Add the drop-off client method, reducer pending state, hook action, and
presentational per-member button. Preserve the existing five-second visible
polling behavior.

- [ ] **Step 3: Run web tests and stop for the user's manual driver UI commit**

Run the focused web tests and report:

```text
feat(driver): add per-rider drop-off controls
```

Do not perform Git operations.

---

### Task 7: Show passenger completion time

**Files:**

- Modify: `apps/web/src/lib/api/types.ts`
- Modify: `apps/web/src/components/passenger/ride-history.tsx`
- Modify: `apps/web/src/components/passenger/current-ride-card.tsx` only if
  needed for the terminal transition display
- Test: `apps/web/tests/use-passenger-rides.test.tsx`
- Test: `apps/web/tests/passenger-dashboard.test.tsx`

- [ ] **Step 1: Write failing passenger UI tests**

Assert that polling replaces the passenger's active ride with `COMPLETED`
history and renders the completion time beside `Completed`.

- [ ] **Step 2: Implement the history display**

Use the API's `completedAt` value and format it with the existing Bangladesh
locale/date formatting approach. Do not add browser token storage or a new
passenger endpoint.

- [ ] **Step 3: Run final workspace verification and stop for the user's manual passenger UI commit**

Run the complete workspace tests, type checks, lint, and build. Report:

```text
feat(passenger): show completed drop-offs
```

Do not perform Git operations.
