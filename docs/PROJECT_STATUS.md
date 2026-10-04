# Project Status

## Current Milestone

The current `feature/pool-route-compatibility` checkpoint is implemented and
awaits the user's manual review, commit, push, and merge. GitHub operations
remain under the user's control. It adds zone-route compatibility, per-pickup
arrival, stable route-stop reads and driver UI, and pool-status-based passenger
fare labels. Driver history UI and deployment were completed in earlier work.

## Completed

- Source documentation and PRD reviewed.
- Architecture and bootstrap plan approved.
- Node.js workspace and pnpm lockfile created.
- Express API health boundary verified.
- Next.js/Tailwind/shadcn/ui web build verified.
- Docker Compose service definitions added and statically checked.
- PostgreSQL connection pool, transaction helper, and `/health/db` added.
- Numbered migrations, schema constraints, indexes, and deterministic demo seeds added.
- Explicit `db:migrate`, `db:seed`, and `db:setup` commands added.
- Passenger registration, login, logout, current-user lookup, and role middleware added.
- JWT sessions use an HttpOnly `auth_token` cookie with bcrypt password hashing.
- Auth repository queries are parameterized and auth tests run without PostgreSQL.
- Deterministic integer-poysha fare rules and a complete symmetric Dhaka-area distance table added.
- Passenger ride estimate, creation, owned list/detail, and requested-ride cancellation endpoints added.
- Ride creation stores the solo estimated fare; cancellation writes a durable status event in one transaction.
- Passenger ownership is enforced in both the service and parameterized repository queries.
- Driver online/offline snapshots and status updates added, with a database constraint allowing only one active vehicle per driver.
- Going online requires an active vehicle; driver requests are limited to the 50 oldest waiting rides and omit passenger identity.
- Pool matching migration added: each pool stores its pickup zone and a driver can have only one active pool.
- Driver-only ride acceptance creates or reuses a route-compatible pool in one transaction, reserves active seats without exceeding vehicle capacity, stores a solo fare for the first member, reprices every active membership when a later compatible rider joins, updates the ride to `MATCHED`, and records a status event.
- Database-free unit and HTTP tests cover acceptance outcomes, authorization, response privacy, and transaction query contracts.
- An explicit `pnpm test:db` command runs the isolated PostgreSQL final-seat concurrency test only when `POOL_TEST_DATABASE_URL` is supplied.
- A shared ride-state machine now defines every allowed transition, including the existing `REQUESTED` to `CANCELLED` passenger cancellation.
- Pool acceptance locks the driver, active pool, active memberships/rides, then requested ride; only `MATCHED` pools accept new rides, while arrived or started pools return `POOL_NOT_ACCEPTING` without writes.
- Driver-only pickup arrival, start, and per-rider drop-off endpoints transition the assigned pool and member rides in transactions, append status events, and return no passenger identity.
- Lifecycle transitions set `started_at` and `completed_at` only at their matching steps; a completed pool allows the driver to accept a new request into a new `MATCHED` pool.
- Passenger login and registration pages plus protected passenger and driver
  dashboards are available in Next.js.
- Browser API requests are same-origin `/api/...` calls rewritten by Next.js to the private `API_INTERNAL_URL`; no browser token or public API host is used.
- The passenger dashboard creates rides, displays estimated/current/final fares from pool status and stored membership values, polls its active ride every five seconds, shows terminal history, and permits cancellation only while a ride is `REQUESTED`.
- An active ride disables every request form control so users receive a clear in-progress message without mistaking the client lock for API authorization.
- Web tests cover role redirects, API cookie options, request-form locking, stale fare estimates, poll cleanup, loading/error states, and local accessibility primitives.
- A driver-only active-pool read endpoint returns the assigned active pool, vehicle, occupied seats, and minimal active-member operational data; it returns a null data envelope when none exists and never exposes passenger email or ID.
- The driver dashboard loads status once, refreshes waiting requests and the
  active pool every five seconds only while its tab is visible, serializes
  actions behind live refreshes, pauses polling for pending actions, and cleans
  up work on unmount.
- Driver controls require an active vehicle before going online, disable while
  actions are pending, provide code-specific acceptance conflict messages, and
  refresh operational data after every action result.
- The active-pool card renders only permitted member names, route stops, seats,
  and membership fares; it shows Nusrat at `71.00 Tk` and Rafiq at `59.00 Tk`
  once they share Bullet, and requires confirmation before completing a started
  pool.
- Migration 011 adds `ride_requests.completed_at`, backfills it from completed
  pools, and enforces the completed-status timestamp check.
- Occupied seats are consistently defined as active memberships whose ride is
  not `COMPLETED`; this protects matched capacity and active-pool responses.
- Per-rider drop-off now completes only the selected started ride, records one
  status event, preserves membership fares, and completes the pool when its
  last active rider is dropped off. The old pool-level completion endpoint is
  a no-write `POOL_COMPLETION_REQUIRES_DROPOFF` guard.
- Backend tests cover partial/final drop-off, occupancy (`1` occupied/`2`
  available after one rider leaves Bullet), duplicate and cross-driver
  rejection, fare immutability, completion timestamps, and the matched-seat
  capacity regression.
- `GET /api/driver/history` returns the authenticated driver's 50 newest
  completed pools with final member fares and completion times, while exposing
  passenger names only and scoping every result to the owning driver.
- Pool acceptance checks a deterministic route with every pickup before every
  drop-off, using integer detour comparisons and configurable
  `POOL_MAX_DETOUR_PERCENT` (default 35). Different pickup zones can share only
  when every rider remains within the limit; fares remain solo-distance-based
  with no detour surcharge.
- Pickup arrival is tracked per zone. A shared pickup has one action, distinct
  pickups transition independently, and the trip cannot start while any
  matched pickup remains.
- The active-pool API derives an ordered route from all members, including
  completed rides; completed stops are marked done without changing route
  order. The route is not persisted.
- Passenger ride reads include nullable `poolStatus`; fare labels are
  Estimated solo before matching, Current while the pool is `MATCHED`, and
  Final from `DRIVER_ARRIVED` onward.
- The no-show/stuck-pool scenario is documented but intentionally has no
  resolution in this checkpoint.

## Verification Gap

- Verified on this branch: API 30 files/283 tests; web 23 files/129 tests;
  typecheck, lint, production builds, `docker compose config --quiet`, and
  `git diff --check` all pass.
- `pnpm test:db` passed: 2 files/9 tests against an isolated temporary local
  database, which was removed after verification.
- A full `docker compose up --build` was not run; rerun it as a clean-stack
  check after integrating this branch. Compose configuration validation passed.

## Deferred Follow-up

Detailed passenger pool history beyond each passenger's own ride records is
deferred. This branch adds no passenger endpoints and does not expose other
riders' information.

The current manual Git checkpoint is:

```text
Branch: feature/pool-route-compatibility
Commit: feat(pool): support route-compatible pickup stops
```

Previous merged checkpoint:

```text
Branch: feature/per-rider-dropoff
Commit: feat(pool): add per-rider drop-off lifecycle
```
