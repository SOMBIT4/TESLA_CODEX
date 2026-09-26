# Passenger Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add production-shaped passenger registration, login, logout, current-user lookup, JWT cookie authentication, and reusable role middleware to the Express API.

**Architecture:** Keep the existing `/api` router and central error envelope, adding an `/api/auth` module with schema, controller, service, repository, and middleware boundaries. The service receives repository/security dependencies so endpoint tests can use an in-memory repository while the default runtime uses parameterized PostgreSQL queries, bcryptjs, and jsonwebtoken.

**Tech Stack:** Node.js, TypeScript, Express 5, Zod, PostgreSQL via `pg`, `bcryptjs`, `jsonwebtoken`, Vitest, and Supertest.

**Spec:** `docs/superpowers/specs/2026-09-26-passenger-auth-design.md`

## Global Constraints

- The public registration endpoint always creates `PASSENGER` users and ignores unknown `role` fields.
- Passwords are hashed with bcrypt and never appear in JWT payloads, public responses, logs, or README examples.
- JWT payloads contain only `sub` and `role`, and use `env.JWT_SECRET` plus `env.JWT_EXPIRES_IN`.
- The auth cookie is named `auth_token`, is HttpOnly, uses SameSite Lax and path `/`, and is secure only in production.
- SQL queries must remain parameterized and public-user mapping must omit `password_hash`.
- Auth tests must not require a live PostgreSQL database.
- Do not commit or push from this task; the user will perform the manual Git checkpoint.

## Review Focus

- Privilege escalation through a registration `role` field — `auth.integration.test.ts` asserts the created user remains `PASSENGER` and the response omits the field.
- Credential and token leakage — `auth.service.test.ts` and `auth.integration.test.ts` assert bcrypt hashes are stored internally, raw passwords are absent from tokens/responses, and public user objects expose only safe fields.
- Authentication edge cases — `auth.integration.test.ts` and `auth.middleware.test.ts` cover unknown users, wrong passwords, missing cookies, malformed JWTs, expired JWTs, and deleted users.
- Cookie lifecycle — `auth.integration.test.ts` covers HttpOnly login/register cookies and repeatable logout clearing.
- Authorization drift — `auth.middleware.test.ts` covers passenger rejection and driver acceptance for `requireRole("DRIVER")`.

---

### Task 1: Auth dependencies, types, schemas, and security primitives

**Files:**
- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/api/src/modules/auth/auth.types.ts`
- Create: `apps/api/src/modules/auth/auth.schema.ts`
- Create: `apps/api/src/modules/auth/auth.security.ts`
- Test: `apps/api/tests/auth.schema.test.ts`
- Test: `apps/api/tests/auth.security.test.ts`

**Interfaces:**
- Produces `UserRole`, `AuthUserRecord`, `PublicUser`, `AuthIdentity`, `RegisterInput`, `LoginInput`, `registerSchema`, `loginSchema`, `hashPassword`, `comparePassword`, `signAuthToken`, `verifyAuthToken`, `AUTH_COOKIE_NAME`, and cookie option helpers for later tasks.

- [ ] **Step 1: Add the runtime and type dependencies**

Add `bcryptjs` and `jsonwebtoken` to `apps/api` dependencies, and `@types/jsonwebtoken` to dev dependencies. Update the lockfile with the repository’s pnpm version.

- [ ] **Step 2: Write the failing schema tests**

In `auth.schema.test.ts`, assert that registration trims names, lowercases and trims emails, strips a supplied `role`, accepts an 8-character password, and rejects names shorter than 2 characters, invalid emails, and passwords shorter than 8 or longer than 72 characters. Assert the login schema applies the same email normalization.

- [ ] **Step 3: Run the schema tests to verify RED**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- auth.schema.test.ts --run`

Expected: FAIL because the auth schema module does not exist yet.

- [ ] **Step 4: Implement the auth types and Zod schemas**

Create the types and schemas with the exact normalization and limits from the spec. Use a non-strict object behavior that strips unknown fields, so registration cannot elevate a role and does not fail merely because an extra field was submitted.

- [ ] **Step 5: Run the schema tests to verify GREEN**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- auth.schema.test.ts --run`

Expected: all schema tests pass.

- [ ] **Step 6: Write the failing security primitive tests**

In `auth.security.test.ts`, assert a hashed password differs from the raw password and is accepted by `comparePassword`, a wrong password is rejected, a signed token verifies to exactly `sub` and `role`, and an expired token is rejected. Assert cookie options include `httpOnly`, `sameSite: "lax"`, `path: "/"`, and `secure: false` outside production.

- [ ] **Step 7: Run the security tests to verify RED**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- auth.security.test.ts --run`

Expected: FAIL because the security module does not exist yet.

- [ ] **Step 8: Implement bcrypt, JWT, and cookie helpers**

Use bcryptjs with a fixed cost appropriate for the MVP, jsonwebtoken with the configured secret and expiry, and a typed token payload containing only `sub` and `role`. Convert token verification failures into a caller-detectable invalid-token result; do not log token contents. Build one shared cookie-options helper so setting and clearing use matching security attributes.

- [ ] **Step 9: Run the security tests to verify GREEN**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- auth.security.test.ts --run`

Expected: all security tests pass.

- [ ] **Step 10: Run the API typecheck**

Run: `pnpm --filter @dhaka-tesla-pool/api typecheck`

Expected: TypeScript passes with the new dependencies and auth primitives.

### Task 2: Parameterized user repository and auth service

**Files:**
- Create: `apps/api/src/modules/auth/auth.repository.ts`
- Create: `apps/api/src/modules/auth/auth.service.ts`
- Test: `apps/api/tests/auth.repository.test.ts`
- Test: `apps/api/tests/auth.service.test.ts`

**Interfaces:**
- Consumes the types, schemas, and security helpers from Task 1.
- Produces `AuthRepository`, `createAuthRepository`, `AuthService`, and `createAuthService` for the controller and middleware.

- [ ] **Step 1: Write the failing repository tests**

In `auth.repository.test.ts`, provide a fake `query` function and assert `findByEmail` uses a `WHERE email = $1` query with the normalized email as a parameter, `findById` uses `WHERE id = $1`, and `createPassenger` passes generated user values as query parameters rather than interpolating them. Assert the row mapper returns internal `passwordHash` and `createdAt` fields for the service only.

- [ ] **Step 2: Run the repository tests to verify RED**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- auth.repository.test.ts --run`

Expected: FAIL because the repository module does not exist yet.

- [ ] **Step 3: Implement the repository**

Use `db` by default but accept a small `query`-capable dependency for tests. Select only the user columns required by authentication, insert a generated UUID with role `PASSENGER`, and preserve PostgreSQL errors so the service can map unique-email violations. Keep all values in `$1`, `$2`, and `$3` parameters.

- [ ] **Step 4: Run the repository tests to verify GREEN**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- auth.repository.test.ts --run`

Expected: all repository tests pass.

- [ ] **Step 5: Write the failing service tests**

In `auth.service.test.ts`, use an in-memory fake repository and assert registration hashes the password, creates only a `PASSENGER`, returns a public user plus token, maps a PostgreSQL unique violation to `EMAIL_ALREADY_REGISTERED` with status 409, maps unknown and wrong login credentials to the same `INVALID_CREDENTIALS` 401 error, and maps a missing current user to `UNAUTHENTICATED` 401. Assert the public mapping omits `passwordHash`.

- [ ] **Step 6: Run the service tests to verify RED**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- auth.service.test.ts --run`

Expected: FAIL because the service module does not exist yet.

- [ ] **Step 7: Implement the auth service**

Create the service with injected repository, password, and token functions. Implement `register`, `login`, and `getCurrentUser`, generate a UUID for new users, map internal records to `PublicUser`, and translate only the specified duplicate and credential cases into stable `AppError` instances.

- [ ] **Step 8: Run the service tests to verify GREEN**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- auth.service.test.ts --run`

Expected: all service tests pass.

- [ ] **Step 9: Run the API typecheck and focused test set**

Run: `pnpm --filter @dhaka-tesla-pool/api typecheck; pnpm --filter @dhaka-tesla-pool/api test -- auth.schema.test.ts auth.security.test.ts auth.repository.test.ts auth.service.test.ts --run`

Expected: typecheck passes and all focused auth tests pass.

### Task 3: Auth middleware, controllers, routes, and app wiring

**Files:**
- Create: `apps/api/src/modules/auth/auth.middleware.ts`
- Create: `apps/api/src/modules/auth/role.middleware.ts`
- Create: `apps/api/src/modules/auth/auth.controller.ts`
- Create: `apps/api/src/modules/auth/auth.routes.ts`
- Create: `apps/api/src/middleware/validate.middleware.ts`
- Create: `apps/api/src/types/express.d.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/index.ts`
- Test: `apps/api/tests/auth.middleware.test.ts`
- Test: `apps/api/tests/auth.integration.test.ts`

**Interfaces:**
- Consumes `AuthService`, `PublicUser`, and token helpers from Tasks 1–2.
- Produces the mounted endpoints `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, and `GET /api/auth/me`, plus `requireAuth` and `requireRole` middleware for future modules.

- [ ] **Step 1: Write the failing middleware tests**

In `auth.middleware.test.ts`, create a small Express route protected by `requireAuth` and a second route protected by `requireAuth` plus `requireRole("DRIVER")`. Assert missing, malformed, and expired cookies return the exact `401 UNAUTHENTICATED` envelope, passenger access returns `403 FORBIDDEN`, and a valid driver token reaches the handler.

- [ ] **Step 2: Run the middleware tests to verify RED**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- auth.middleware.test.ts --run`

Expected: FAIL because the middleware modules do not exist yet.

- [ ] **Step 3: Implement validation, request identity typing, and middleware**

Add generic `validateBody(schema)` middleware that converts Zod failures to `VALIDATION_ERROR` 400 errors. Augment Express requests with an optional typed authenticated identity. Read only the `auth_token` cookie, verify it, attach `{ userId, role }`, and reject invalid identities; `requireRole` must return `FORBIDDEN` for authenticated users outside the allowed role list.

- [ ] **Step 4: Run the middleware tests to verify GREEN**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- auth.middleware.test.ts --run`

Expected: all middleware tests pass.

- [ ] **Step 5: Write the failing endpoint integration tests**

In `auth.integration.test.ts`, create an app with a real auth service backed by an in-memory repository. Assert:

```text
POST /api/auth/register -> 201, PASSENGER public user, auth_token HttpOnly cookie
POST /api/auth/register with role DRIVER -> 201, still PASSENGER
duplicate normalized email -> 409 EMAIL_ALREADY_REGISTERED
POST /api/auth/login -> 200 and auth_token cookie
unknown email and wrong password -> identical 401 INVALID_CREDENTIALS envelopes
POST /api/auth/logout with or without cookie -> 200 loggedOut true and cleared cookie
GET /api/auth/me with a valid cookie -> 200 authenticated public user only
GET /api/auth/me after repository deletion -> 401 UNAUTHENTICATED
invalid body -> 400 VALIDATION_ERROR
```

Assert that `passwordHash`, raw `password`, and token payload details are absent from response bodies and that the cookie has `HttpOnly` and `SameSite=Lax` attributes.

- [ ] **Step 6: Run the endpoint tests to verify RED**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- auth.integration.test.ts --run`

Expected: FAIL because the auth routes are not mounted yet.

- [ ] **Step 7: Implement controllers and routes**

Keep controllers limited to validated request input, service calls, cookie setting/clearing, and `{ data: ... }` response envelopes. Mount a default PostgreSQL-backed service in production while allowing `createApp({ authService })` injection in tests. Make logout idempotent and mount the four routes under `/api/auth`.

- [ ] **Step 8: Run the endpoint tests to verify GREEN**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- auth.integration.test.ts --run`

Expected: all endpoint tests pass.

- [ ] **Step 9: Run the complete API test suite**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run`

Expected: existing health/database/schema tests and all auth tests pass.

### Task 4: Seed credentials, README documentation, and branch verification

**Files:**
- Modify: `database/seeds/001_demo_users.sql`
- Modify: `README.md`
- Test: `apps/api/tests/auth-documentation.test.ts`

**Interfaces:**
- Consumes the completed API contract from Tasks 1–3.
- Produces a documented local demo account expectation and a reproducible branch verification baseline.

- [ ] **Step 1: Write the failing documentation test**

In `auth-documentation.test.ts`, assert README documents all four `/api/auth` endpoints, says authentication uses the HttpOnly cookie, and includes the demo passenger email from the seed without including a JWT secret or password hash.

- [ ] **Step 2: Run the documentation test to verify RED**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- auth-documentation.test.ts --run`

Expected: FAIL because README does not yet document the auth milestone.

- [ ] **Step 3: Update the demo seed and README**

Use the documented demo-only password `demo1234` for the seeded accounts by replacing the existing sample hash with a bcrypt hash for that password. Add the auth endpoints, cookie behavior, and local demo passenger login expectation to README; do not document secrets or raw database credentials beyond the existing local-development examples.

- [ ] **Step 4: Run the documentation test to verify GREEN**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- auth-documentation.test.ts --run`

Expected: all documentation tests pass.

- [ ] **Step 5: Run final repository verification**

Run:

```powershell
pnpm typecheck
pnpm lint
pnpm test -- --run
pnpm build
pnpm format:check
docker compose config
```

Expected: every command exits successfully. Docker database setup remains a manual host check if Docker is available.

- [ ] **Step 6: Stop at the manual Git checkpoint**

Do not commit or push. Report the changed files, verification results, branch name `feature/passenger-auth`, and this commit message for the user to run manually:

```text
feat(auth): add passenger authentication
```

The user will perform `git add`, `git commit`, `git push -u origin feature/passenger-auth`, and the pull request merge workflow.
