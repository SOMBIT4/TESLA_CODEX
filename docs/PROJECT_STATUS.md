# Project Status

## Current Milestone

The driver-flow feature branch is implemented and will be merged locally into
`master` after final verification. GitHub pushes remain under the user's
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

## Verification Gap

- Run `docker compose config`, `docker compose up -d db`, and `pnpm db:setup` locally to verify the real PostgreSQL connection and migration execution.

## Next Feature Branch

`feature/tesla-pooling`

The current manual Git checkpoint is:

```text
Branch: feature/driver-flow
Commit: feat(driver): add availability endpoints
```
