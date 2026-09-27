# Dhaka Tesla Pool

> Share a seat. Split the fare. Survive Dhaka traffic.

Dhaka Tesla Pool is an internship MVP for deterministic ride pooling around Dhaka zones. Passengers request rides, compatible requests share Jashim's three-seat vehicle Bullet, each passenger receives an individual fare, and PostgreSQL protects seat capacity under concurrent claims.

## Stack

- Node.js and TypeScript
- Next.js App Router
- Tailwind CSS and shadcn/ui
- Express REST API
- PostgreSQL with raw `pg` SQL
- Docker Compose

## Source Documentation

The original documentation pack is preserved in [`dhaka-tesla-pool-docs/`](dhaka-tesla-pool-docs/). The PRD, engineering blueprint, and five-page challenge brief remain the source material for implementation decisions.

Maintained implementation documentation begins in [`docs/`](docs/README.md), including the [architecture](docs/ARCHITECTURE.md), [ERD](docs/ERD.md), and [project status](docs/PROJECT_STATUS.md).

## Current Database Milestone

The repository foundation and PostgreSQL schema are established. This includes
the Node.js workspace, runnable web and API boundaries, Tailwind/shadcn/ui
foundation, Docker services, raw `pg` access, numbered migrations, deterministic
demo seeds, transaction helpers, database health checks, and passenger
authentication. Passenger ride requests and deterministic fare estimates are
available. Driver availability and the privacy-safe waiting-request view are
available. An online driver can accept a compatible request into one
capacity-safe pool and advance it through arrival, start, and completion. The
passenger and driver frontends remain on later feature branches.

## Passenger Authentication

The API exposes the first authentication slice under `/api/auth`:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

Registration and login create an HttpOnly `auth_token` cookie using the
configured JWT secret and expiry. Protected requests send that cookie; logout
clears it. The API also provides reusable role middleware for later driver and
passenger features.

After running `pnpm db:setup`, the seeded passenger demo account is:

```text
Email:    nusrat@example.com
Password: demo1234
```

This password is for local demonstration only and must not be reused.

## Fare Engine

Fare calculations use integer poysha and a deterministic MVP distance table:

- Base fare: 5000 poysha
- Distance charge: 1200 poysha per kilometre
- Pool discount: 1500 poysha per seat

The fare is calculated per seat, so the returned total is the fare for one
seat multiplied by the requested seat count. The distance table is a static
MVP estimate rather than live map routing. Ride requests will store the solo
estimate first; accepting a ride into a pool stores the final discounted fare
on that pool membership.

## Passenger Ride Requests

The ride API provides a public, deterministic estimate plus passenger-owned
ride management:

```text
POST /api/rides/estimate
POST /api/rides
GET  /api/rides/me
GET  /api/rides/:rideId
POST /api/rides/:rideId/cancel
```

`POST /api/rides/estimate` validates the route and returns the solo fare in
poysha. The remaining endpoints require an authenticated passenger cookie.
Creating a ride stores that solo estimate in `estimated_fare_poysha`; a future
pool membership stores the final pooled fare. On this branch a passenger may
cancel only a `REQUESTED` ride, and cancellation records a status event.

## Driver Availability and Requests

The following endpoints require an authenticated driver cookie:

```text
GET  /api/driver/me
POST /api/driver/status
GET  /api/driver/requests
POST /api/driver/requests/:rideId/accept
POST /api/driver/pools/:poolId/arrive
POST /api/driver/pools/:poolId/start
POST /api/driver/pools/:poolId/complete
```

`GET /api/driver/me` supplies the first-load driver snapshot. It, and a
successful `POST /api/driver/status` request with `{ "isOnline": boolean }`,
return the current online state and active vehicle. A driver may go offline at
any time. Going online requires one active vehicle; otherwise the API returns
`409 NO_ACTIVE_VEHICLE` without changing the driver's state.

`GET /api/driver/requests` returns up to 50 `REQUESTED` rides, oldest first.
Its response intentionally excludes passenger IDs, names, and email addresses.

## Driver Pool Acceptance

An online driver accepts a waiting ride with an empty-body request to
`POST /api/driver/requests/:rideId/accept`. The operation is one PostgreSQL
transaction: it locks the driver, then the active pool, then the requested
ride; it creates or reuses a pool, reserves seats, changes the ride to
`MATCHED`, and writes a status event.

A compatible ride must have the same pickup zone as the driver's active pool;
destinations may differ. A driver can have only one active pool, and the
vehicle capacity snapshot prevents reservations above its available seats.
The pool membership stores the final integer-poysha pooled fare while the ride
request retains its earlier solo estimate. The `201` response includes only
the pool summary and membership summary—never passenger name, email, or ID.

Acceptance can return `409 DRIVER_OFFLINE`, `NO_ACTIVE_VEHICLE`,
`RIDE_ALREADY_MATCHED`, `RIDE_NOT_COMPATIBLE`, `POOL_FULL`, or
`POOL_NOT_ACCEPTING`. A pool accepts rides only while its status is `MATCHED`;
an arrived or started pool returns `POOL_NOT_ACCEPTING` without creating a
membership. It returns `404` for an unknown ride or missing driver profile.

## Driver Pool Lifecycle

The assigned driver advances a pool with empty-body requests to:

```text
POST /api/driver/pools/:poolId/arrive
POST /api/driver/pools/:poolId/start
POST /api/driver/pools/:poolId/complete
```

The only allowed flow is:

```text
MATCHED -> DRIVER_ARRIVED -> STARTED -> COMPLETED
```

Each action is one transaction. It locks the assigned driver's profile, pool,
and active member rides; changes the pool and every active ride together; and
writes one immutable status event per ride. Repeated, skipped, and reversed
actions return `409 INVALID_POOL_TRANSITION`. Another driver's pool returns
`404 POOL_NOT_FOUND` without revealing its existence.

Starting records `pools.started_at`; completion records `pools.completed_at`.
Membership fares are never changed by lifecycle actions, so starting is the
final-fare lock boundary. The response includes only the updated pool summary
and transitioned ride IDs—never passenger names, email addresses, or
passenger IDs. A completed pool no longer occupies the active-pool constraint,
so an online driver with an active vehicle can accept a later request into a
new `MATCHED` pool.

## Local Setup

Requirements:

- Node.js 24 or a compatible current LTS release
- pnpm 11
- Docker Desktop for Compose verification

Copy the environment template and install dependencies:

```powershell
Copy-Item .env.example .env
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Start both local applications:

```powershell
pnpm dev
```

The web app will use port 3000 and the API will use port 4000. The bootstrap API health endpoint is `GET http://localhost:4000/health`.

To start PostgreSQL and load the schema plus demo data:

```powershell
docker compose up -d db
pnpm db:setup
```

The database health endpoint is `GET http://localhost:4000/health/db`.

If Compose publishes PostgreSQL on a port other than `5432`, inspect it with
`docker compose port db 5432` and set `DATABASE_URL` to the matching local
connection before running database commands.

## Docker

The Compose topology contains `web`, `api`, and `db` services. PostgreSQL is
available to the API as `db:5432`. The host port is configurable, so inspect
it with `docker compose port db 5432` before choosing a host-side connection:

```powershell
docker compose config
docker compose up --build
```

After the database service is healthy, run `pnpm db:setup` from the host.

## Verification

The bootstrap checks are:

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
docker compose config
pnpm db:setup
```

The first four commands run in the current workspace. Docker Compose verification requires Docker Desktop to be installed and running.

The real pool capacity-race check is deliberately separate from `pnpm test`.
Use only a local disposable database, set `DATABASE_URL` to it, then set the
same value for `POOL_TEST_DATABASE_URL` in the same PowerShell session:

```powershell
docker compose up -d db
$env:POOL_TEST_DATABASE_URL = $env:DATABASE_URL
pnpm db:setup
pnpm test:db
```

`pnpm test:db` fails closed when `POOL_TEST_DATABASE_URL` is absent, so it
cannot silently connect to the default database. It creates isolated records,
races two claims for the final seat, and cleans up the records afterwards.

## Git Workflow

The project follows the documented feature-branch flow in [`dhaka-tesla-pool-docs/docs/GIT_WORKFLOW.md`](dhaka-tesla-pool-docs/docs/GIT_WORKFLOW.md). The first manual checkpoint is:

```text
Branch: master
Commit: chore(repo): initialize node monorepo structure
```

Codex will not create the remote or push to GitHub. GitHub pushes remain under
the user's control.
