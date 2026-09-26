# Project Status

## Current Milestone

The passenger-auth feature branch is implemented pending local Docker and
PostgreSQL integration verification.

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

## Verification Gap

- Run `docker compose config`, `docker compose up -d db`, and `pnpm db:setup` locally to verify the real PostgreSQL connection and migration execution.

## Next Feature Branch

`feature/ride-request`

The current manual Git checkpoint is:

```text
Branch: feature/passenger-auth
Commit: feat(auth): add passenger authentication
```
