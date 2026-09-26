# Project Status

## Current Milestone

The tesla-pooling feature branch is implemented and awaits the user's manual
review, commit, push, and merge. GitHub pushes remain under the user's control.

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

## Verification Gap

- Start Docker Desktop, then run `docker compose up -d db`, set `DATABASE_URL` and `POOL_TEST_DATABASE_URL` to the same local database, run `pnpm db:setup`, and finally run `pnpm test:db` to verify the real PostgreSQL final-seat race.

## Next Feature Branch

`feature/pool-lifecycle`

The current manual Git checkpoint is:

```text
Branch: feature/tesla-pooling
Commit: feat(pool): add transactional ride pooling
```
