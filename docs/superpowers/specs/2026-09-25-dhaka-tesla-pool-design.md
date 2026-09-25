# Dhaka Tesla Pool Design Specification

**Date:** 2026-09-25  
**Status:** Proposed for implementation  
**Source material:** `dhaka-tesla-pool-docs/`, `Dhaka_Tesla_Pool_PRD_Internship.pdf`, and `Dhaka_Tesla_Pool_Professional_Project_Blueprint.md`

## Purpose

Build a small, explainable ride-pooling MVP for the Dhaka Tesla Pool internship challenge. The system must let passengers request rides, let a driver manage a shared three-seat vehicle, calculate passenger-specific fares, preserve lifecycle history, and prevent capacity corruption under concurrent final-seat claims.

The implementation repository will use `E:\tesla_codex` as its root. The existing `dhaka-tesla-pool-docs/` directory remains available as the source/reference documentation pack while the implementation's maintained documentation is established in the repository root.

## Goals and Success Criteria

The first release must support:

- passenger registration, login, logout, current-user lookup, ride creation, cancellation, and ride history;
- driver login, online/offline status, request discovery, pool acceptance, arrival, start, completion, and history;
- explicit pool membership with per-passenger reserved seats and fare;
- deterministic compatibility for the demo routes Banani -> Mohakhali and Banani -> Gulshan 1;
- integer poysha money storage and hand-verifiable fares;
- server-side authorization and validation;
- centralized ride-state transition validation;
- PostgreSQL constraints, migrations, seeds, and transaction-safe capacity allocation;
- meaningful unit and integration tests, including a concurrent final-seat test;
- reproducible Docker Compose startup with web, API, and PostgreSQL services;
- documentation that explains architecture, choices, assumptions, limitations, AI usage, and the six-minute demo.

The MVP is complete only when core correctness, reproducibility, and documented Git history are in place. Visual polish is secondary to data integrity, authorization, lifecycle correctness, and concurrency safety.

## Explicit Non-Goals

The MVP will not implement real map routing, GPS tracking, payment processing, chat, push notifications, surge pricing, ratings, ML matching, microservices, Kafka, Kubernetes, Redis-based locking, or a distributed event system.

## Product Rules

### Actors and seed story

- Jashim is the driver.
- Bullet is Jashim's active three-seat vehicle.
- Nusrat is a passenger using Banani -> Mohakhali.
- Rafiq is a passenger using Banani -> Gulshan 1.
- Shirin is the passenger used for capacity and concurrency scenarios.

### Geography and matching

Supported zones are Banani, Gulshan 1, Gulshan 2, Mohakhali, Dhanmondi, Mirpur, Uttara, Farmgate, and Bashundhara.

A request may join a pool only when the pickup zone is compatible, the destination pair is configured as compatible, the driver is online, the vehicle is active, the pool has not started, and enough seats remain. The initial compatibility table explicitly allows Banani -> Mohakhali and Banani -> Gulshan 1 to share a pool.

### Fare

The fare rule is:

```text
passengerFare = baseFare + (distanceKm * ratePerKm) - poolDiscount
```

Initial deterministic constants are base fare ৳50, rate ৳12/km, pool discount ৳15, Banani -> Mohakhali distance 3 km, and Banani -> Gulshan 1 distance 2 km. Pooled fares are therefore Nusrat ৳71 / 7100 poysha and Rafiq ৳59 / 5900 poysha. All persisted money values are integer poysha; floating-point values are not used for money.

The ride request stores the estimated fare at creation. Pool membership stores the final pooled fare. The final fare is immutable once the ride enters `STARTED`.

### Lifecycle

Ride request states are `REQUESTED`, `MATCHED`, `DRIVER_ARRIVED`, `STARTED`, `COMPLETED`, and `CANCELLED`.

Allowed transitions are:

```text
REQUESTED      -> MATCHED, CANCELLED
MATCHED        -> DRIVER_ARRIVED, CANCELLED
DRIVER_ARRIVED -> STARTED, CANCELLED
STARTED        -> COMPLETED
COMPLETED      -> none
CANCELLED      -> none
```

All successful transitions pass through one state-machine module and append an immutable status event. Cancellation is passenger-owned and allowed only before `STARTED`.

## Architecture

The repository is a monorepo with one web app, one API, one PostgreSQL database, and shared project documentation.

```text
Browser
  |
  v
Next.js App Router + Tailwind + shadcn/ui
  |
  | REST / JSON
  v
Node.js + Express + TypeScript API
  |
  | parameterized SQL through pg
  v
PostgreSQL
```

### Frontend

The Next.js application uses App Router, TypeScript, Tailwind CSS, and shadcn/ui components. Pages remain thin. Reusable UI belongs in components, API calls belong in `lib/api`, and client validation is for user experience only. Each data-heavy screen provides loading, empty, error, and success states.

The initial screens are login, registration, passenger dashboard/request/current ride/history, and driver dashboard/requests/current pool/history. The frontend never becomes the authority for authorization, fare correctness, state transitions, or capacity.

### Backend

The API uses Node.js, Express, TypeScript, Zod, bcrypt, jsonwebtoken, and `pg`. Backend dependencies flow in one direction:

```text
route -> middleware -> controller -> service -> repository -> PostgreSQL
```

Routes map HTTP methods and middleware. Middleware handles authentication, roles, validation, request IDs, and errors. Controllers handle HTTP input/output only. Services own business rules. Repositories own SQL only. Database constraints enforce durable invariants.

Authentication uses email/password, bcrypt hashes, JWT expiry, and an HttpOnly cookie. Production cookies are secure. Protected writes derive identity from the authenticated token and never trust a passenger ID supplied by the browser.

### Database

The initial schema contains `users`, `drivers`, `vehicles`, `ride_requests`, `pools`, `pool_memberships`, `ride_status_events`, and `schema_migrations`.

Important invariants include role and status checks, positive seat/capacity checks, foreign keys, unique user email, one driver profile per user, one membership per ride request, indexes for passenger history, request discovery, route compatibility, driver pool status, pool memberships, and ride status events.

Each pool stores `capacity_snapshot` so historical capacity remains explainable if vehicle configuration changes later.

### Capacity and concurrency

Pool acceptance and membership creation are one transaction. The service locks the pool row with `SELECT ... FOR UPDATE`, recomputes active reserved seats, validates capacity and pool status, inserts the membership, updates the ride state, writes the status event, and commits. A losing concurrent final-seat claim receives `409 POOL_FULL`; the database must never contain active seats above the capacity snapshot.

## API Boundary

The public API uses `/api`, JSON responses, and this envelope:

```json
{ "data": {} }
```

Errors use:

```json
{ "error": { "code": "POOL_FULL", "message": "Bullet has no seats remaining." } }
```

The initial endpoint groups are:

- auth: register, login, logout, and current user;
- rides: estimate, create, current user list, owned detail, and owned cancellation;
- driver: online/offline status, relevant requests, and history;
- pools: accept request, details, arrive, start, and complete.

Expected HTTP classes are 200, 201, 400, 401, 403, 404, 409, and 500. Domain errors include validation failure, authentication failure, forbidden access, not found, invalid transition, full pool, duplicate membership, offline driver, inactive vehicle, and internal error.

## Project Layout

The implementation will use this initial shape:

```text
apps/web/                 Next.js frontend
apps/api/                 Express API
database/migrations/      numbered SQL migrations
database/seeds/            deterministic demo seed data
database/scripts/          migration, seed, and reset helpers
scripts/                   project-level helpers
docs/                      maintained implementation documentation
docker-compose.yml         web, api, and db services
.env.example               placeholder environment configuration
package.json               workspace scripts and shared tooling
```

Backend modules are organized by auth, users, drivers, vehicles, rides, pools, matching, fares, and history. The ride state machine lives with the rides module. Database SQL is never placed in controllers or frontend code.

## Testing Strategy

Risk-first tests are required:

- unit tests for fare calculations, matching compatibility, and lifecycle transitions;
- integration tests for authentication, ride ownership, cancellation, pool capacity, lifecycle endpoints, and history events;
- a PostgreSQL-backed concurrency test that starts with two occupied seats and two simultaneous one-seat claims, then verifies exactly one success and a final occupied count of three;
- tests that prove a passenger cannot modify another passenger's ride and that invalid transitions return the stable domain error.

The test database is isolated from development data. Test setup runs migrations and uses deterministic fixtures.

## Docker and Operations

Docker Compose exposes the web app on port 3000 and API on port 4000, with PostgreSQL available to services through the internal network. The API provides `/health` and a database-aware health check. Migrations and seeds are explicit and documented. `.env` and real secrets are ignored; `.env.example` contains placeholders only.

## Documentation and Ownership

The maintained README will cover the problem, features, story cast, architecture, ERD, stack decisions, project layout, assumptions, lifecycle, matching, fares, capacity, security, API, setup, Docker, migrations, seeds, tests, deployment, limitations, future improvements, AI usage, scaling, and demo video.

AI usage will be documented honestly, including one accepted suggestion and one rejected or changed suggestion. The developer remains responsible for understanding and explaining all submitted code.

## Git and Delivery Constraints

The user will perform GitHub branch creation, commits, remote setup, and pushes manually. Codex must not push to GitHub or create external GitHub state.

The first local bootstrap baseline is intended for `master`, with the commit message:

```text
chore(repo): initialize node monorepo structure
```

After that baseline is pushed manually, feature work proceeds on `feature/database-schema` and subsequent `feature/*` branches. Commit messages follow `<type>(<scope>): <short description>`, with one logical change per commit. Long-lived branches remain `master`, `pre-release`, and `release/v1.0.0`.

## First Milestone

The first implementation milestone establishes the Node.js workspace and minimal runnable boundaries:

1. workspace package configuration and scripts;
2. TypeScript configuration and formatting/linting baseline;
3. Next.js web app with Tailwind and shadcn/ui foundation;
4. Express API with `/health`;
5. database and scripts directories;
6. environment example, ignore rules, Docker skeleton, and maintained README starter;
7. source documentation references preserved;
8. verification that web and API start successfully.

This milestone deliberately stops before database schema and business features. It is the manual Git checkpoint for the user's first push.
