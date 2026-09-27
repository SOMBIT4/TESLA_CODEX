# Pool Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an assigned driver safely advance a matched pool and all active
member rides through arrival, start, and completion.

**Architecture:** Add a pure ride transition table to the rides module, then
extend the existing pools vertical slice with transactional lifecycle actions.
Every lifecycle write locks the driver, pool, then member rides, making the
pool status, ride statuses, and status-event history atomic. Acceptance adopts
the same lock order and refuses any active pool that is no longer `MATCHED`.

**Tech Stack:** Node.js, TypeScript, Express 5, PostgreSQL via `pg`, Vitest,
Supertest, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-27-pool-lifecycle-design.md`

## Global Constraints

- Use the existing `route -> controller -> service -> repository -> PostgreSQL`
  dependency direction.
- Use parameterized SQL and the existing `withTransaction` helper for every
  multi-table lifecycle write.
- Lifecycle locks are ordered: driver row, pool row, then member rides.
- Only `MATCHED` pools accept new rides; `DRIVER_ARRIVED` and `STARTED` return
  `409 POOL_NOT_ACCEPTING` without writes.
- Passenger cancellation remains `REQUESTED -> CANCELLED` only, but must use
  the shared ride state-machine module.
- Do not add a migration for this branch.
- Responses must not expose passenger name, email, or passenger ID.
- The user alone performs Git staging, commits, pushes, and merges. Do not run
  Git-mutating commands.

## Review Focus

- A lifecycle action races with acceptance for the same driver; lock ordering
  must serialize the operations instead of leaving mismatched states.
- A driver starts or completes a pool twice; the second request must make no
  status or event writes.
- A pool belongs to a different driver; the endpoint must return 404 without
  exposing its existence.
- One active member ride is already inconsistent with the pool state; the
  defensive mismatch guard must roll back all writes.
- The driver completes a pool, then accepts another request; a new `MATCHED`
  pool must be created instead of reusing the completed one.

---

### Task 1: Centralize ride transition rules

**Files:**
- Create: `apps/api/src/modules/rides/ride-state-machine.ts`
- Modify: `apps/api/src/modules/rides/ride.service.ts`
- Test: `apps/api/tests/ride-state-machine.test.ts`
- Test: `apps/api/tests/ride.service.test.ts`

**Interfaces:**
- Consumes: `RideStatus` from `apps/api/src/modules/rides/ride.types.ts`.
- Produces: `VALID_RIDE_TRANSITIONS` and
  `canTransitionRide(from: RideStatus, to: RideStatus): boolean` for the
  lifecycle service and passenger cancellation.

- [ ] **Step 1: Write failing pure state-machine tests**

Cover each allowed edge: `REQUESTED -> MATCHED`, `REQUESTED -> CANCELLED`,
`MATCHED -> DRIVER_ARRIVED`, `DRIVER_ARRIVED -> STARTED`, and
`STARTED -> COMPLETED`. Assert skipped, reversed, terminal, and
`STARTED -> CANCELLED` transitions return `false`.

- [ ] **Step 2: Run the new state-machine tests and verify RED**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/ride-state-machine.test.ts`

Expected: FAIL because the state-machine module does not exist.

- [ ] **Step 3: Implement the pure transition module**

Create `VALID_RIDE_TRANSITIONS` as a complete readonly mapping for every
`RideStatus`, including empty arrays for terminal states. Implement
`canTransitionRide` as a pure lookup with no database or Express dependency.

- [ ] **Step 4: Make passenger cancellation use the shared rule**

In `cancelPassengerRide`, keep the existing status-specific repository update
and public `INVALID_RIDE_TRANSITION` response, but replace the duplicated
`ride.status !== "REQUESTED"` business check with
`canTransitionRide(ride.status, "CANCELLED")`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/ride-state-machine.test.ts tests/ride.service.test.ts`

Expected: PASS.

- [ ] **Step 6: Manual Git checkpoint**

Do not run Git commands. Keep this task's changes available for the user's
single branch commit after all lifecycle tasks pass.

### Task 2: Make acceptance and lifecycle repository transitions atomic

**Files:**
- Modify: `apps/api/src/modules/pools/pool.types.ts`
- Modify: `apps/api/src/modules/pools/pool.repository.ts`
- Test: `apps/api/tests/pool.repository.test.ts`

**Interfaces:**
- Consumes: the existing `PoolTransactionRunner`/`PoolQueryClient` interfaces.
- Produces: `transitionPool(input, createStatusEventId)` on `PoolRepository`,
  lifecycle outcome types, and the `pool_not_accepting` acceptance outcome.

- [ ] **Step 1: Write failing repository tests**

Add tests that assert:

1. acceptance queries driver, then active pool, then requested ride;
2. acceptance returns `pool_not_accepting` and has no membership, ride, or
   event writes for a `DRIVER_ARRIVED` pool;
3. a lifecycle transition locks driver, owned pool, then active memberships
   and rides; updates every ride; and inserts one event per ride;
4. a mismatched member ride produces `pool_ride_state_mismatch` with no
   updates; and
5. a repeated lifecycle action returns `invalid_pool_transition` before any
   pool, ride, or event write; and
6. lifecycle updates preserve membership fare and set only the applicable pool
   timestamp, while acceptance after a completed pool creates a new `MATCHED`
   pool.

- [ ] **Step 2: Run the repository tests and verify RED**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/pool.repository.test.ts`

Expected: FAIL because lifecycle repository methods and outcomes do not exist
and acceptance currently locks the ride before the pool.

- [ ] **Step 3: Extend pool domain types**

Add lifecycle input, success, and outcome types. Lifecycle input includes the
driver user ID, pool ID, expected pool status, and target pool status.
Lifecycle success returns a privacy-safe pool summary and transitioned ride
IDs. Add `pool_not_accepting`, `pool_not_found`,
`invalid_pool_transition`, and `pool_ride_state_mismatch` outcomes.

- [ ] **Step 4: Correct acceptance lock ordering and acceptance state**

Lock the driver row first, then that driver's active pool, then the requested
ride. Accept only when the existing pool is `MATCHED`; return
`pool_not_accepting` for `DRIVER_ARRIVED` or `STARTED` before any write. When
no active pool exists after `COMPLETED`, continue to create a new `MATCHED`
pool using the existing capacity and pickup-zone safeguards.

- [ ] **Step 5: Implement `PoolRepository.transitionPool`**

Within one `withTransaction` callback, lock the driver's profile, lock the
owned pool, verify its exact expected status, then lock every `ACTIVE`
membership and its ride. Verify every member ride status matches the expected
status before any update. Update the pool and only its applicable timestamp,
update every active ride to the target status, and insert a status event per
ride using `createStatusEventId()`. Return an outcome instead of committing
partial writes on any failed guard.

- [ ] **Step 6: Run repository tests and verify GREEN**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/pool.repository.test.ts`

Expected: PASS.

- [ ] **Step 7: Manual Git checkpoint**

Do not run Git commands. Keep changes uncommitted for the user's final manual
checkpoint.

### Task 3: Expose lifecycle actions through the pool service and API

**Files:**
- Modify: `apps/api/src/modules/pools/pool.service.ts`
- Modify: `apps/api/src/modules/pools/pool.controller.ts`
- Modify: `apps/api/src/modules/pools/pool.routes.ts`
- Modify: `apps/api/tests/pool.service.test.ts`
- Modify: `apps/api/tests/pool.integration.test.ts`

**Interfaces:**
- Consumes: Task 1's `canTransitionRide` and Task 2's lifecycle repository
  method and outcomes.
- Produces: `PoolService.arrive`, `PoolService.start`, and
  `PoolService.complete`, each accepting `(driverUserId: string, poolId: string)`.

- [ ] **Step 1: Write failing service and HTTP tests**

Add service tests for outcome-to-error mapping and action-to-status mapping.
Add Supertest coverage for the three driver routes: unauthenticated requests
return 401, passenger requests return 403, missing/other-driver pools return
404, a valid sequence returns 200, invalid repeated or skipped actions return
`INVALID_POOL_TRANSITION`, and responses contain no passenger identity.

Add an HTTP regression case showing `POOL_NOT_ACCEPTING` for an arrived pool.
Use the repository-level test for the no-write assertion and a completed-pool
acceptance test for the new-pool behavior.

- [ ] **Step 2: Run service and HTTP tests and verify RED**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/pool.service.test.ts tests/pool.integration.test.ts`

Expected: FAIL because lifecycle service methods and routes do not exist.

- [ ] **Step 3: Implement service methods and stable errors**

Map `arrive` to `MATCHED -> DRIVER_ARRIVED`, `start` to
`DRIVER_ARRIVED -> STARTED`, and `complete` to `STARTED -> COMPLETED`. Confirm
the corresponding ride transition with `canTransitionRide`, generate a fresh
event ID per active ride through the repository callback, and map outcomes to
the exact public error codes in the specification.

- [ ] **Step 4: Implement controller and routes**

Add `POST /pools/:poolId/arrive`, `/start`, and `/complete` beneath the
existing `/api/driver` router. Reuse driver-only middleware, read only the
session user ID and route pool ID, and return `{ data: lifecycleResult }` with
HTTP 200.

- [ ] **Step 5: Run focused lifecycle tests and verify GREEN**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/pool.service.test.ts tests/pool.integration.test.ts`

Expected: PASS.

- [ ] **Step 6: Manual Git checkpoint**

Do not run Git commands. Leave the branch ready for the user's one manual
commit after final verification.

### Task 4: Document the lifecycle and verify the branch

**Files:**
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`
- Test: `apps/api/tests/auth-documentation.test.ts`

**Interfaces:**
- Consumes: public API and error contracts from Task 3.
- Produces: maintained setup/API documentation and the next feature-branch
  recommendation.

- [ ] **Step 1: Write failing documentation assertions**

Extend the documentation test to require the lifecycle route names and
`POOL_NOT_ACCEPTING` in the maintained README.

- [ ] **Step 2: Run the documentation test and verify RED**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/auth-documentation.test.ts`

Expected: FAIL because lifecycle documentation is absent.

- [ ] **Step 3: Update maintained documentation**

Document the three actions, synchronized pool/ride lifecycle, fare-lock
boundary, started/arrived acceptance rejection, and database test prerequisite.
Set project status to the completed lifecycle checkpoint and name
`feature/passenger-frontend` as the next recommended branch without altering
Git state.

- [ ] **Step 4: Run final verification**

Run:

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm --filter @dhaka-tesla-pool/api build
```

Expected: all commands exit 0. If Docker Desktop is available, also run
`pnpm test:db` with `DATABASE_URL` and `POOL_TEST_DATABASE_URL` configured.

- [ ] **Step 5: Manual Git checkpoint**

Do not run Git commands. Give the user the exact intended file list, one
commit message, verification result, and a GitHub-ready merge description.
