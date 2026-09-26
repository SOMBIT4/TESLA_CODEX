# Architecture

## Bootstrap topology

```mermaid
flowchart LR
    B[Browser]
    W[Next.js Web\nTailwind + shadcn/ui]
    A[Node.js + Express API]
    D[(PostgreSQL)]

    B --> W
    W -->|REST / JSON| A
    A -->|Parameterized SQL via pg| D
```

The database-schema milestone adds a raw `pg` connection pool, explicit SQL
migrations and seeds, transaction helpers, and a database-aware health check.
Domain repositories and business queries remain on later feature branches.

## Frontend boundary

The Next.js App Router application owns pages, reusable components, Tailwind styling, shadcn/ui primitives, loading/error/empty states, and API client code. The frontend may validate input for user experience, but it is never the authority for authentication, authorization, fare correctness, ride transitions, or vehicle capacity.

## Backend boundary

The Express API will follow this dependency direction:

```text
Route
  ↓
Middleware
  ↓
Controller
  ↓
Service
  ↓
Repository
  ↓
PostgreSQL
```

Routes map HTTP methods and URLs. Middleware handles request IDs, authentication, roles, validation, and errors. Controllers translate HTTP requests and responses. Services own product rules. Repositories own SQL only. PostgreSQL enforces durable relationships, constraints, transactions, and locks.

The API exposes `GET /health`, `GET /health/db`, and a small `/api` boundary. Authentication, rides, fares, matching, pools, and history will be added in later feature branches.

## Planned domain boundaries

The planned modules are auth, users, drivers, vehicles, rides, pools, matching, fares, and history. The ride state machine is centralized under the rides module. Pool acceptance will use a PostgreSQL transaction and `SELECT ... FOR UPDATE` before membership insertion.

Database setup is explicit: `pnpm db:migrate` applies numbered SQL files,
`pnpm db:seed` loads deterministic demo data, and `pnpm db:setup` runs both.
`GET /health` checks the API process; `GET /health/db` executes `SELECT 1`.

## Containers

```mermaid
flowchart LR
    B[Browser]
    W[web container :3000]
    A[api container :4000]
    D[(postgres container)]

    B --> W
    W --> A
    A --> D
```

Docker Compose defines `web`, `api`, and `db`. The database service has a
health check and exposes a configurable development port for host-run
migration commands while remaining available to the API over the internal
Compose network.
