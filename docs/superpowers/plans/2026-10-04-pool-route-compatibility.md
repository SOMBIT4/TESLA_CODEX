# Pool Route Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Allow only detour-compatible rides to join a shared pool, support arrival at each pickup zone, keep displayed route order stable through passenger drop-offs, and show passenger fares according to pool status.

**Architecture:** Keep the route calculation pure and separate from persistence. Acceptance evaluates all non-completed members plus the newcomer while holding the existing driver → pool → memberships/rides → requested ride locks, then performs no writes until route and capacity checks pass. The active-pool read derives an ordered route from all active memberships, including completed rides, and adds stop completion flags without persisting route state. Per-pickup arrival changes only the selected group and permits a mixed MATCHED/DRIVER_ARRIVED pool. Passenger ride reads include pool status so both current and history fare labels use the same rule.

**Tech Stack:** Node.js, TypeScript, Express 5, PostgreSQL via pg, Zod, Vitest, Supertest, React, Next.js, Tailwind, and the existing shadcn-style components.

**Spec:** docs/superpowers/specs/2026-10-04-pool-route-compatibility-design.md

## Global Constraints

- Do not change the fare formula, fare distance table, database schema, authentication, payment behavior, unrelated routes, or unrelated UI behavior.
- Do not persist a route plan or add a routing provider, GPS enforcement, traffic estimates, no-show workflow, or stuck-pool recovery.
- A route visits all distinct pickup zones before any drop-off phase. The pool's original pickup zone remains the first pickup and route anchor.
- Define route distance from a zone to itself as 0 in the route module only. Do not change fare-engine same-zone validation.
- Read POOL_MAX_DETOUR_PERCENT from validated API config; default to 35 and allow only integer values from 0 through 100.
- Use integer comparisons for detour thresholds. Route tie-breaks must be deterministic and independent of database row order or ride IDs.
- Check route compatibility and occupied capacity before any acceptance write or fare repricing. Rejection must not change membership, ride status, fares, or events.
- Occupied seats are active memberships whose ride status is not COMPLETED.
- Only MATCHED pools accept new rides. Per-stop arrival is permitted while the pool is MATCHED or DRIVER_ARRIVED, and only when that stop still has MATCHED rides.
- A DRIVER_ARRIVED pool may contain both MATCHED and DRIVER_ARRIVED rides. Start is rejected until all non-completed members are DRIVER_ARRIVED.
- The passenger fare label depends on pool status, not individual ride status: no membership means Estimated solo fare; MATCHED means Current fare; DRIVER_ARRIVED or later means Final fare. The formal fare lock remains STARTED.
- The active-pool route includes all ACTIVE memberships, including completed rides, so drop-offs cannot reorder stops. Completed rides do not count toward occupied seats.
- Arrival requires a JSON pickupZone. Missing, malformed, or unsupported values return 400 VALIDATION_ERROR. A supported zone without a MATCHED rider at that pool returns 409 PICKUP_STOP_NOT_AVAILABLE without writes.
- Driver responses may contain passenger names and seats only; never email, phone number, or passenger user ID.
- Document the no-show/stuck-pool limitation in README.md, but do not implement a resolution in this branch.
- The user alone stages, commits, pushes, and merges. Do not run Git-mutating commands. Finish all branch work and verification, then stop for the user's manual commit.

## Review Focus

- The seeded Nusrat/Rafiq same-pickup example passes at 35%; it fails at 30%.
- A compatible different-pickup example and an incompatible different-pickup example both have explicit distance/detour assertions.
- Opposite directions and a newcomer who pushes an existing member over the threshold are rejected before any database writes.
- Same-zone route legs cost zero, while fare estimation continues rejecting same-zone ride requests.
- Starting is blocked when any pickup group remains MATCHED; a later eligible pickup action succeeds on the already DRIVER_ARRIVED pool. Acceptance and arrival keep a shared lock order so they cannot race past the MATCHED-only acceptance boundary.
- Route stop identities and order remain identical after a passenger completes; the completed passenger's stops become done.
- Fare labels use pool status even when the individual ride status is still MATCHED.
- Capacity, concurrency, ownership, privacy, fare-lock, and existing lifecycle tests remain green.

---

### Task 1: Implement the pure route calculator and validate its configuration

**Files:**

- Create: apps/api/src/modules/pools/pool-route.ts
- Test: apps/api/tests/pool-route.test.ts
- Modify: apps/api/src/config/env.ts
- Test: apps/api/tests/env.test.ts

**Interfaces:**

- Define PoolRouteRide with rideId, pickupZone, and destinationZone.
- Define PoolRouteStopKind as PICKUP or DROPOFF.
- Define PlannedPoolRouteStop with kind, zone, and member ride IDs.
- Define PoolRiderDetour with rideId, soloDistanceKm, inVehicleDistanceKm, and detourKm.
- Define PoolRouteEvaluation with compatible, ordered stops, per-rider detours, and totalRouteDistanceKm.
- Export getRouteDistanceKm(from: DhakaArea, to: DhakaArea): number; return 0 when both zones are equal and otherwise delegate to the existing fare distance lookup.
- Export calculateBestPoolRoute(rides: readonly PoolRouteRide[], startZone: DhakaArea, maxDetourPercent: number): PoolRouteEvaluation.
- Add env.POOL_MAX_DETOUR_PERCENT, parsed as an integer in the inclusive range 0–100 with default 35.

- [x] **Step 1: Add failing pure route tests**

Test:

1. Nusrat Banani → Mohakhali plus Rafiq Banani → Gulshan 1 selects Gulshan 1 before Mohakhali and passes at 35%; assert each solo distance, in-vehicle distance, and detour.
2. The same pair fails at 30%.
3. The different-pickup pair Banani → Gulshan 1 plus Gulshan 1 → Mohakhali passes, with each rider's in-vehicle distance equal to solo distance.
4. The different-pickup pair Banani → Gulshan 1 plus Uttara → Dhanmondi fails because the original Banani rider exceeds the limit in every order.
5. Opposite-direction routes fail when no all-pickups-first order is compatible.
6. A newcomer pushing an existing member over the limit makes the whole route incompatible.
7. An exact integer threshold passes and a case one percentage point above it fails.
8. Tied route choices return the same order across repeated calls and reversed input order.
9. Same-zone route distance is 0, and a synthetic same-zone pickup/drop-off route has zero in-vehicle distance.
10. Invalid detour limits are rejected; environment parsing defaults to 35, accepts a valid override, and rejects fractional, negative, and over-100 values.

- [x] **Step 2: Run route/config tests and verify RED**

Run:

~~~powershell
pnpm --filter @dhaka-tesla-pool/api exec vitest --run tests/pool-route.test.ts tests/env.test.ts
~~~

Expected: fail because the route module and detour configuration do not exist.

- [x] **Step 3: Implement the pure route calculator and config value**

Build phase-grouped pickup and drop-off stops. Keep the pool anchor as the first pickup, enumerate the remaining pickup and drop-off permutations, calculate each rider's route distance from their own pickup to their own drop-off, and choose the order by lowest maximum detour ratio, then lowest total distance, then the declared DHAKA_AREAS order. Use cross multiplication for ratio comparisons and integer threshold checks. Do not inspect ride status while choosing the route.

- [x] **Step 4: Run route/config tests and verify GREEN**

Run the command from Step 2. Expected: all route and config tests pass.

---

### Task 2: Apply route compatibility inside transactional ride acceptance

**Files:**

- Modify: apps/api/src/modules/pools/pool.types.ts
- Modify: apps/api/src/modules/pools/pool.repository.ts
- Modify: apps/api/src/modules/pools/pool.service.ts
- Test: apps/api/tests/pool.repository.test.ts
- Test: apps/api/tests/pool.service.test.ts
- Test: apps/api/tests/pool.db.integration.ts

**Interfaces:**

- Add a route-incompatible acceptance outcome and map it to HTTP 409 ROUTE_INCOMPATIBLE.
- Inject the validated detour limit into the pool repository/service without making the pure calculator depend on process.env.
- Preserve the transaction lock order: driver → pool → active membership/ride rows → requested ride.

- [x] **Step 1: Add failing repository/service acceptance tests**

Cover compatible different pickup and destination acceptance; both incompatible different-pickup scenarios; opposite directions; a newcomer who pushes an existing member over the limit; and exact-threshold acceptance. For every rejection, assert that there are no membership inserts, ride status changes, fare updates, or status events. Preserve seat-capacity and row-lock assertions.

- [x] **Step 2: Run focused acceptance tests and verify RED**

Run:

~~~powershell
pnpm --filter @dhaka-tesla-pool/api test -- --run tests/pool.repository.test.ts tests/pool.service.test.ts
~~~

Expected: new compatibility cases fail because acceptance still requires the same pickup zone and has no route outcome.

- [x] **Step 3: Implement transactional compatibility checks**

After locking and validating the candidate rides, calculate the complete route for all active non-completed members plus the newcomer. Check route compatibility and capacity before creating a pool/membership, changing ride status, repricing fares, or inserting events. Replace the old same-pickup rejection with ROUTE_INCOMPATIBLE. Retain MATCHED-only pool acceptance and the existing occupancy rule.

- [x] **Step 4: Run focused and database acceptance tests**

Run:

~~~powershell
pnpm --filter @dhaka-tesla-pool/api test -- --run tests/pool.repository.test.ts tests/pool.service.test.ts
pnpm --filter @dhaka-tesla-pool/api exec vitest --config vitest.db.config.ts --run tests/pool.db.integration.ts
~~~

The database test requires a disposable local PostgreSQL database through POOL_TEST_DATABASE_URL. Expected: capacity and final-seat concurrency behavior remain green.

---

### Task 3: Implement per-pickup arrival and mixed pickup lifecycle states

**Files:**

- Modify: apps/api/src/modules/pools/pool.types.ts
- Modify: apps/api/src/modules/pools/pool.repository.ts
- Modify: apps/api/src/modules/pools/pool.service.ts
- Modify: apps/api/src/modules/pools/pool.controller.ts
- Modify: apps/api/src/modules/pools/pool.routes.ts
- Test: apps/api/tests/pool.repository.test.ts
- Test: apps/api/tests/pool.service.test.ts
- Test: apps/api/tests/pool.integration.test.ts

**Interfaces:**

- Change PoolService.arrive to require arrive(driverUserId: string, poolId: string, pickupZone: DhakaArea).
- Add a repository arrival input containing driverUserId, poolId, pickupZone, and IDs for one event per ride transitioned.
- Parse a required JSON body containing pickupZone. Missing, malformed, or non-Dhaka areas map to HTTP 400 VALIDATION_ERROR.
- A valid pickupZone with no MATCHED rides in the driver's pool maps to HTTP 409 PICKUP_STOP_NOT_AVAILABLE.

- [x] **Step 1: Add failing arrival/start tests**

Cover one shared pickup group; two different pickup groups where the first arrival changes only its own MATCHED rides; a later pickup action on the DRIVER_ARRIVED pool; retrying a stop with no MATCHED rides; no body, malformed body, and unsupported zone; supported but unavailable zone; another driver's pool; and start rejection with any MATCHED member. Assert exact writes and one event per transitioned ride.

- [x] **Step 2: Run lifecycle tests and verify RED**

Run:

~~~powershell
pnpm --filter @dhaka-tesla-pool/api test -- --run tests/pool.repository.test.ts tests/pool.service.test.ts tests/pool.integration.test.ts
~~~

Expected: fail because arrival currently transitions the entire pool from MATCHED and takes no pickupZone.

- [x] **Step 3: Implement per-stop arrival and mismatch guards**

Lock driver, pool, active memberships, and rides using the existing lock order. Permit arrival only for MATCHED or DRIVER_ARRIVED pools and only for a selected stop with MATCHED rides. Transition only those rides and write exactly one event per changed ride. The pool becomes DRIVER_ARRIVED on the first successful stop and stays there. Permit the mixed DRIVER_ARRIVED-pool / MATCHED-or-DRIVER_ARRIVED-rides shape. Start only when every active non-completed ride is DRIVER_ARRIVED; otherwise return PICKUPS_REMAINING with no writes.

- [x] **Step 4: Run focused lifecycle tests and verify GREEN**

Run the command from Step 2. Expected: authentication, ownership, validation, mixed-state, no-write, and event assertions pass.

---

### Task 4: Derive stable active-pool route stops and passenger pool status

**Files:**

- Modify: apps/api/src/modules/pools/pool.types.ts
- Modify: apps/api/src/modules/pools/pool.repository.ts
- Modify: apps/api/src/modules/pools/pool.controller.ts
- Modify: apps/api/src/modules/rides/ride.types.ts
- Modify: apps/api/src/modules/rides/ride.repository.ts
- Modify: apps/api/src/modules/rides/ride.controller.ts
- Test: apps/api/tests/pool.repository.test.ts
- Test: apps/api/tests/active-pool.integration.test.ts
- Test: apps/api/tests/ride.repository.test.ts
- Test: apps/api/tests/ride.integration.test.ts

**Interfaces:**

- Add ride status to each active-pool member used to derive route progress.
- Add ordered routeStops to DriverActivePool. Each stop has kind, zone, done, and members containing rideId, passengerName, and seatsReserved. Route stops include completed rides; the active members list and occupiedSeats continue to exclude COMPLETED rides.
- Add poolStatus: PoolStatus | null to RideRecord and passenger ride API responses.

- [x] **Step 1: Add failing active-route and passenger-read tests**

Assert the active-pool response contains grouped pickup/drop-off stops in route order and no passenger email, phone number, or user ID. Call the route builder/read mapping before and after one member changes to COMPLETED: stop order and identities must be equal, the completed member's pickup/drop-off must be done, and occupied seats must decrease. Assert passenger ride create returns null poolStatus; owned detail/list reads return the joined pool status and current membership fare.

- [x] **Step 2: Run read tests and verify RED**

Run:

~~~powershell
pnpm --filter @dhaka-tesla-pool/api test -- --run tests/pool.repository.test.ts tests/active-pool.integration.test.ts tests/ride.repository.test.ts tests/ride.integration.test.ts
~~~

Expected: fail because routeStops and poolStatus are not returned.

- [x] **Step 3: Implement derived route and pool-status read mapping**

For active-pool reads, calculate the route from every ACTIVE membership, including rides already COMPLETED. Keep ride status out of the route-order decision; derive done separately from status. Keep completed rides in route-stop membership data but out of occupied seats and the current-member list. For passenger reads, left-join pool status through the active membership and map it as null when no membership exists. Do not add a migration or expose other passenger data.

- [x] **Step 4: Run focused read tests and verify GREEN**

Run the command from Step 2. Expected: route stability, completed-stop markers, occupancy, passenger ownership, and privacy tests pass.

---

### Task 5: Update the driver dashboard for route guidance and per-stop arrival

**Files:**

- Modify: apps/web/src/lib/api/types.ts
- Modify: apps/web/src/lib/api/driver.ts
- Modify: apps/web/src/hooks/use-driver-dashboard.ts
- Modify: apps/web/src/components/driver/active-pool-card.tsx
- Modify: apps/web/src/components/driver/driver-dashboard.tsx
- Modify: apps/web/src/lib/i18n/messages.ts
- Test: apps/web/tests/driver-api.test.ts
- Test: apps/web/tests/use-driver-dashboard.test.tsx
- Test: apps/web/tests/driver-dashboard.test.tsx

- [x] **Step 1: Add failing driver API and UI tests**

Assert the arrive request submits the selected pickupZone; each pickup stop lists passenger names and seats; shared-zone riders have one action; distinct stops can be arrived one at a time; completed route stops render as done; start is disabled while any pickup remains MATCHED; ROUTE_INCOMPATIBLE displays friendly copy; unknown errors retain the server message; pending actions remain serialized and trigger the existing immediate refresh.

- [x] **Step 2: Run focused web tests and verify RED**

Run:

~~~powershell
pnpm --filter @dhaka-tesla-pool/web exec vitest --run tests/driver-api.test.ts tests/use-driver-dashboard.test.tsx tests/driver-dashboard.test.tsx
~~~

Expected: fail because arrival has no zone input and the dashboard has no route-stop model.

- [x] **Step 3: Implement driver route and arrival UI**

Extend API types, send pickupZone with each arrive request, and render the ordered route stops as both the route list and map markers. Distinguish pickup/drop-off phases, group members sharing a phase/zone, and mark completed stops done. Expose one action for each pickup stop with MATCHED rides. Keep existing polling, mutation serialization, responsive layout, and passenger privacy constraints.

- [x] **Step 4: Run focused driver tests and verify GREEN**

Run the command from Step 2. Expected: API body, route grouping, completion marker, friendly conflict copy, and lifecycle controls pass.

---

### Task 6: Make current and history fare labels follow pool status

**Files:**

- Modify: apps/web/src/lib/api/types.ts
- Modify: apps/web/src/components/passenger/current-ride-card.tsx
- Modify: apps/web/src/components/passenger/ride-history.tsx
- Test: apps/web/tests/passenger-dashboard.test.tsx
- Test: apps/web/tests/use-passenger-rides.test.tsx

- [x] **Step 1: Add failing passenger fare-label tests**

Test that a ride with a MATCHED pool displays Current fare; a ride with a DRIVER_ARRIVED pool displays Final fare even while its own ride status remains MATCHED; STARTED and COMPLETED pools display Final fare in history; and a ride with no pool uses Estimated solo fare. Assert stored membership fare is used when present.

- [x] **Step 2: Run passenger tests and verify RED**

Run:

~~~powershell
pnpm --filter @dhaka-tesla-pool/web exec vitest --run tests/passenger-dashboard.test.tsx tests/use-passenger-rides.test.tsx
~~~

Expected: fail because the UI currently infers fare labels from ride status.

- [x] **Step 3: Implement pool-status label selection**

Use poolStatus as the sole label-state source. Keep the solo estimate as the no-membership fallback and use the membership fare when one is returned. Preserve existing ride status, polling, cancellation, and history behavior.

- [x] **Step 4: Run passenger tests and verify GREEN**

Run the command from Step 2. Expected: active fare and history labels match the pool lifecycle.

---

### Task 7: Document assumptions, configure Compose, and run full verification

**Files:**

- Modify: .env.example
- Modify: docker-compose.yml
- Modify: README.md
- Modify: docs/PROJECT_STATUS.md
- Modify: docs/superpowers/specs/2026-10-04-pool-route-compatibility-design.md

- [x] **Step 1: Update configuration and product documentation**

Pass POOL_MAX_DETOUR_PERCENT through the API service in docker-compose.yml and add its default value to .env.example. Update README.md to explain why 35% supports Nusrat's 33⅓% detour with Rafiq, how to override the integer setting, the zone-distance/all-pickups-first assumptions, different-pickup compatibility examples, no detour surcharge, per-pickup arrival, fare labels/lock boundary, and the explicitly deferred no-show/stuck-pool case. Update product status without claiming deployment or Git integration.

- [x] **Step 2: Run all deterministic verification**

Run:

~~~powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
docker compose config
git diff --check
~~~

Expected: all API/web tests, type checks, lint, builds, Compose interpolation, and whitespace checks pass. Review the complete diff and ensure generated files, secrets, unrelated changes, and persistent route data are absent.

- [x] **Step 3: Run the database regression suite**

Use only a disposable local PostgreSQL database. In the same PowerShell session, set POOL_TEST_DATABASE_URL to that database, then run:

~~~powershell
pnpm test:db
~~~

Expected: the final-seat concurrency and capacity regressions remain green. Do not point this test at Neon or another production database.

Passed against an isolated temporary local PostgreSQL database after applying
all 12 migrations and 2 seed files: 2 database test files / 9 tests passed. The
temporary database was dropped after the run. A full `docker compose up
--build` startup was not run and remains a clean-stack check after integration.

- [x] **Step 4: Stop for the user's manual Git action**

Do not stage, commit, push, or merge. Report the modified files, verification results, and any remaining baseline issue. Stop so the user can inspect and create their own commit on feature/pool-route-compatibility.

