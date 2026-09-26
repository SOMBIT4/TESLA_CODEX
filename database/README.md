# Database Operations

The project uses PostgreSQL 16 with raw parameterized SQL through `pg`. The
database schema is split into numbered migrations, and deterministic demo data
is loaded by explicit seed commands.

## Migration order

The migration order is:

1. `001_create_users.sql`
2. `002_create_drivers.sql`
3. `003_create_vehicles.sql`
4. `004_create_ride_requests.sql`
5. `005_create_pools.sql`
6. `006_create_pool_memberships.sql`
7. `007_create_ride_status_events.sql`
8. `008_add_indexes.sql`
9. `009_add_driver_availability_constraints.sql`
10. `010_add_pool_matching_constraints.sql`

The runner creates `schema_migrations`, sorts SQL files by filename, skips
applied versions, records a version only after a successful transaction, and
rolls back a failed migration.

Migration `010` stores the shared pickup zone on each pool and guarantees that
a driver has at most one active pool (`MATCHED`, `DRIVER_ARRIVED`, or
`STARTED`).

## Local commands

Start PostgreSQL through Docker and install the workspace dependencies:

```powershell
docker compose up -d db
pnpm install
```

Run migrations and deterministic demo seeds:

```powershell
pnpm db:migrate
pnpm db:seed
```

Or run both operations together:

```powershell
pnpm db:setup
```

The default host connection is
`postgresql://postgres:postgres@localhost:5432/dhaka_tesla_pool`. Set
`DATABASE_URL` explicitly when using another PostgreSQL instance. Never point
reset or test commands at production data.

## Demo seed data

The seeds create Jashim as the online driver, Bullet as his active three-seat
vehicle, and Nusrat, Rafiq, and Shirin as passengers. Seed SQL is idempotent
and uses fixed UUIDs so the story remains stable across local runs.

## API database health

`GET /health` checks only that the API process is alive. `GET /health/db`
executes `SELECT 1` and returns the database readiness envelope, or a `503`
`DATABASE_UNAVAILABLE` error when PostgreSQL cannot be reached.
