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
available; driver flows, pooling, and the broader lifecycle remain on later
feature branches.

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
estimate first; the final pooled fare will be assigned when pool membership is
created.

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

## Docker

The Compose topology contains `web`, `api`, and `db` services. PostgreSQL is
available to the API as `db:5432` and to local migration commands as
`localhost:5432`:

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

## Git Workflow

The project follows the documented feature-branch flow in [`dhaka-tesla-pool-docs/docs/GIT_WORKFLOW.md`](dhaka-tesla-pool-docs/docs/GIT_WORKFLOW.md). The first manual checkpoint is:

```text
Branch: master
Commit: chore(repo): initialize node monorepo structure
```

Codex will not create the remote, push to GitHub, or commit on the user's behalf.
