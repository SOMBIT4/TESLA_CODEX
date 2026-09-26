# Ride Request Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the passenger ride-request API with deterministic solo fare estimates, passenger ownership checks, and safe requested-ride cancellation.

**Architecture:** Add a `modules/rides` vertical slice following the existing route → controller → service → repository boundary. The service derives the authenticated passenger ID, delegates all SQL to a parameterized repository, calls the existing pure fare engine for a solo estimate, and uses a database transaction to record cancellation and its status event together.

**Tech Stack:** Node.js 24, TypeScript, Express 5, Zod, PostgreSQL with raw `pg`, Vitest, Supertest, pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-09-25-dhaka-tesla-pool-design.md`, `dhaka-tesla-pool-docs/docs/API.md`, `Dhaka_Tesla_Pool_Professional_Project_Blueprint.md`

## Global Constraints

- Work on `feature/ride-request`; do not commit, push, merge, or create remote Git state.
- Reuse `calculateFare(pickup, destination, seats, false)` and persist its solo result as `estimated_fare_poysha`.
- Accept only the nine `DHAKA_AREAS`, reject matching pickup/destination, and accept seats 1–3 inclusive.
- Passenger-scoped reads and writes must use `WHERE passenger_id = $userId`; another passenger receives `404`.
- Only `REQUESTED → CANCELLED` is supported on this branch; all other cancellation attempts return a stable conflict.
- Cancellation and its `ride_status_events` insert must share one transaction.
- Follow the repository JSON envelope and existing auth/role middleware conventions.

## Review Focus

- A driver JWT must not create or read passenger ride requests; integration tests must receive `403 FORBIDDEN`.
- A passenger must not view or cancel another passenger’s ride; route and SQL tests must receive `404 RIDE_NOT_FOUND` and prove the passenger filter is parameterized.
- Invalid seat counts and equal zones must fail before the service calculates a fare; schema/integration tests must receive `400 VALIDATION_ERROR`.
- New rides must store the solo fare even though a pooled estimate exists; service tests must pin the Banani → Mohakhali result at `8600` poysha.
- A second cancellation must not add another status event; service/repository tests must receive `409 INVALID_RIDE_TRANSITION`.

---

### Task 1: Ride domain contract and persistence repository

**Files:**
- Create: `apps/api/src/modules/rides/ride.types.ts`
- Create: `apps/api/src/modules/rides/ride.schema.ts`
- Create: `apps/api/src/modules/rides/ride.repository.ts`
- Test: `apps/api/tests/ride.schema.test.ts`
- Test: `apps/api/tests/ride.repository.test.ts`

**Interfaces:**
- Consumes: `DHAKA_AREAS`, `DhakaArea`, `withTransaction()`, and the existing `ride_requests`/`ride_status_events` schema.
- Produces: `RideInput`, `RideRecord`, `RideRepository`, `createRideRepository()`, and parameterized passenger-owned CRUD/cancellation methods for the service.

- [ ] **Step 1: Write failing schema and repository contract tests**

Assert seat and zone validation, exact passenger ownership clauses for detail/list/cancel queries, and that cancellation updates only a requested owned ride before inserting a `REQUESTED → CANCELLED` event inside one transaction.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/ride.schema.test.ts tests/ride.repository.test.ts`

Expected: FAIL because the rides domain files do not exist.

- [ ] **Step 3: Implement the domain and repository**

Use Zod with `DHAKA_AREAS`, parameterized SQL, `RETURNING` rows, and the existing transaction helper. Return `null` from a conditional cancellation update when no `REQUESTED` owned row is updated.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/ride.schema.test.ts tests/ride.repository.test.ts`

Expected: all ride schema and repository tests pass.

### Task 2: Ride service and HTTP API

**Files:**
- Create: `apps/api/src/modules/rides/ride.service.ts`
- Create: `apps/api/src/modules/rides/ride.controller.ts`
- Create: `apps/api/src/modules/rides/ride.routes.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/index.ts`
- Test: `apps/api/tests/ride.service.test.ts`
- Test: `apps/api/tests/ride.integration.test.ts`

**Interfaces:**
- Consumes: `RideRepository`, `RideInput`, `calculateFare()`, `requireAuth`, and `requireRole("PASSENGER")`.
- Produces: `POST /api/rides/estimate`, `POST /api/rides`, `GET /api/rides/me`, `GET /api/rides/:rideId`, and `POST /api/rides/:rideId/cancel`.

- [ ] **Step 1: Write failing service and integration tests**

Cover the solo fare estimate, `REQUESTED` creation, owned list/detail, driver rejection, Rafiq’s inability to view/cancel Nusrat’s ride, a cancellation event, and a second-cancellation conflict.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/ride.service.test.ts tests/ride.integration.test.ts`

Expected: FAIL because the service and `/api/rides` routes do not exist.

- [ ] **Step 3: Implement the vertical slice**

Derive passenger identity exclusively from the JWT middleware. Make fare estimation informational and make all persistent ride endpoints passenger-only. Convert repository `null` results to `RIDE_NOT_FOUND` or `INVALID_RIDE_TRANSITION` as appropriate.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/ride.service.test.ts tests/ride.integration.test.ts`

Expected: all service and integration tests pass.

### Task 3: Documentation and branch verification

**Files:**
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`
- Test: `apps/api/tests/ride.integration.test.ts`

**Interfaces:**
- Consumes: the completed ride API and fare lifecycle rule.
- Produces: accurate local API documentation and a manual Git checkpoint.

- [ ] **Step 1: Update documentation**

Document the five ride endpoints, passenger-only persistent endpoints, solo estimated-fare storage, and that pool membership sets the final pooled fare later.

- [ ] **Step 2: Run final verification**

Run: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm format:check`.

Expected: all checks for the feature pass; report any inherited repository-wide formatting warnings separately.

- [ ] **Step 3: Stop for the user’s manual Git checkpoint**

Do not commit or push. Report the changed files, verification output, branch `feature/ride-request`, and the recommended commit message:

```text
feat(ride): add passenger ride request endpoints
```
