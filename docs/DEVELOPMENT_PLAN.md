# Development Plan

The implementation is staged so each feature branch has a small, testable responsibility and a meaningful Git history.

## Completed bootstrap

The initial baseline establishes:

- the Node.js workspace and dependency lockfile;
- the Next.js App Router web boundary;
- Tailwind CSS and shadcn/ui-compatible primitives;
- the Express API health boundary;
- Docker Compose service definitions for web, API, and PostgreSQL;
- maintained architecture, ERD, and status documentation.

## Next feature branches

1. `feature/database-schema` - PostgreSQL connection, migrations, constraints, indexes, migration runner, seeds, and database health.
2. `feature/passenger-auth` - registration, login, logout, JWT cookie, current user, and authorization middleware.
3. `feature/ride-request` - supported zones, request validation, ride creation, owned detail, and passenger history.
4. `feature/fare-engine` - deterministic distances, integer poysha calculations, estimates, and fare tests.
5. `feature/driver-flow` - driver online/offline status, vehicle view, and relevant waiting requests.
6. `feature/tesla-pooling` - compatibility, pool creation, memberships, transactional capacity protection, and concurrency tests.
7. `feature/ride-history` - arrival, start, completion, cancellation, and durable status events.
8. `feature/tests` - complete risk-first integration coverage for authorization, lifecycle, fare, capacity, and concurrency.
9. `feature/docker` - migration/seed startup behavior, clean Docker verification, and health checks.
10. `feature/docs` - final README, decisions, screenshots, demo instructions, AI usage, scaling, and release documentation.

## Integration flow

Feature branches merge into `master` when working. `pre-release` is reserved for integration fixes, documentation cleanup, Docker verification, deployment checks, and final test fixes. `release/v1.0.0` is cut from `pre-release` for the final demo and submission.
