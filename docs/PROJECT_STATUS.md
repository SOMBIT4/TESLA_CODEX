# Project Status

## Current Milestone

The passenger-frontend feature branch is implemented and awaits the user's
manual review, commit, push, and merge. GitHub pushes remain under the user's
control.

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
- Driver-only ride acceptance creates or reuses a same-pickup pool in one transaction, reserves active seats without exceeding vehicle capacity, stores the pooled membership fare, updates the ride to `MATCHED`, and records a status event.
- Database-free unit and HTTP tests cover acceptance outcomes, authorization, response privacy, and transaction query contracts.
- An explicit `pnpm test:db` command runs the isolated PostgreSQL final-seat concurrency test only when `POOL_TEST_DATABASE_URL` is supplied.
- A shared ride-state machine now defines every allowed transition, including the existing `REQUESTED` to `CANCELLED` passenger cancellation.
- Pool acceptance locks the driver, active pool, then requested ride; only `MATCHED` pools accept new rides, while arrived or started pools return `POOL_NOT_ACCEPTING` without writes.
- Driver-only arrival, start, and completion endpoints transition the assigned pool and every active member ride in one transaction, append one status event per ride, and return no passenger identity.
- Lifecycle transitions set `started_at` and `completed_at` only at their matching steps; a completed pool allows the driver to accept a new request into a new `MATCHED` pool.
- Passenger login and registration pages, a protected passenger dashboard, and an honest driver placeholder are available in Next.js.
- Browser API requests are same-origin `/api/...` calls rewritten by Next.js to the private `API_INTERNAL_URL`; no browser token or public API host is used.
- The passenger dashboard creates rides, displays only the stored estimated solo fare, polls its active ride every five seconds, shows terminal history, and permits cancellation only while a ride is `REQUESTED`.
- An active ride disables every request form control so users receive a clear in-progress message without mistaking the client lock for API authorization.
- Web tests cover role redirects, API cookie options, request-form locking, stale fare estimates, poll cleanup, loading/error states, and local accessibility primitives.

## Verification Gap

- Static checks, application tests, production builds, and `docker compose
config` are verified on this branch. Docker Desktop's daemon was unavailable
  for the final `docker compose up --build` check; run that command after
  starting Docker Desktop to verify the live container stack.

## Next Feature Branch

`feature/passenger-frontend`

The current manual Git checkpoint is:

```text
Branch: feature/passenger-frontend
Commit: feat(passenger-ui): add same-origin passenger ride dashboard
```
