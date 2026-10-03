# User Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add private, editable passenger and driver profile pages, including optional normalized Bangladesh phone numbers and safe driver vehicle edits.

**Architecture:** Add one nullable phone column and extend the authenticated self-profile API. Add a driver-only vehicle update endpoint that serializes through the existing driver-first lock order. The web app uses the existing cookie-authenticated API client, role-protected profile routes, shared personal-profile UI, and a driver vehicle card.

**Tech Stack:** pnpm workspace, TypeScript, Express 5, Zod 4, PostgreSQL, Next.js 16, React 19, Tailwind CSS 3, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-03-user-profiles-design.md`

## Global Constraints

- Add only `database/migrations/012_add_user_phone_number.sql`; never edit an applied migration.
- Phone is optional, not unique, stored as `+8801...`, and is not verified.
- Keep email read-only; accept valid non-Gmail email addresses as before.
- Scope personal updates to the authenticated session identity; never trust a client-supplied user or driver ID.
- Vehicle name and capacity are editable only while offline and without an active pool (`MATCHED`, `DRIVER_ARRIVED`, or `STARTED`).
- Serialize vehicle edits with driver availability and pool lifecycle work by locking the driver row first.
- Before deploying an API version that reads `phone_number`, apply migration 012 to Neon with `pnpm db:migrate`; never use `db:setup` or `db:seed` against production.
- Preserve existing auth cookies, login/registration behavior, ride/pool/fare behavior, and response compatibility; never expose phone numbers in other users' ride, pool, request, or history responses.
- Before any web implementation, follow `apps/web/AGENTS.md` and read the relevant Next.js 16 guide from `apps/web/node_modules/next/dist/docs/`.
- The project owner handles branch creation, staging, commits, pushes, and merges. Do not stage or commit generated `apps/web/next-env.d.ts`.

## Review Focus

- Empty profile patches and immutable/unknown fields must fail with `400` and no writes; pin this in `apps/api/tests/auth.integration.test.ts`.
- Local/international phone variants, separators, `null`, and malformed numbers must normalize or reject exactly as specified; pin this in `apps/api/tests/auth.schema.test.ts`.
- An offline driver with an active pool must still be blocked from editing vehicle details; pin this in `apps/api/tests/driver.integration.test.ts`.
- Availability or acceptance must not race vehicle-capacity edits; pin driver-first transaction ordering in `apps/api/tests/driver.repository.test.ts` and verify the database lock path in the DB test suite.
- A profile phone number must not leak through ride, pool, request, or history reads; pin this in the existing ride, pool, and driver integration tests.

---

### Task 1: Add the phone column and Bangladesh phone schema

**Files:**
- Create: `database/migrations/012_add_user_phone_number.sql`
- Modify: `apps/api/src/modules/auth/auth.schema.ts`
- Test: `apps/api/tests/schema-files.test.ts`
- Test: `apps/api/tests/auth.schema.test.ts`

**Interfaces:**
- Produces `phoneNumber` parsing for profile updates: omitted means unchanged, `null` means clear, and a valid local or international value is normalized to `+8801...`.
- Exports `profileUpdateSchema` and `ProfileUpdateInput` for the Task 2 self-profile route.
- The migration adds nullable `users.phone_number VARCHAR(20)` only; it adds no uniqueness constraint and changes no previous migration.

- [ ] **Step 1: Write failing migration and phone-schema tests.** Extend the migration inventory to include `012_add_user_phone_number.sql`; assert it adds the nullable column without a uniqueness constraint. Add schema cases for `01712345678` → `+8801712345678`, `+880 1712-345678` → `+8801712345678`, `null`, and malformed values.
- [ ] **Step 2: Run the focused tests and confirm they fail for the missing migration/schema behavior.** Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/schema-files.test.ts tests/auth.schema.test.ts`. Expected: FAIL because migration 012 and the profile phone schema do not exist.
- [ ] **Step 3: Add migration 012 and the profile-update Zod schema.** Trim phone input, remove spaces and hyphens, accept the exact local/international patterns from the spec, normalize local input to `+880...`, allow `null`, and reject malformed values. Keep existing registration/login schemas unchanged.
- [ ] **Step 4: Rerun the focused tests.** Run the same command. Expected: PASS, including the ordered migration-file inventory.

### Task 2: Extend the authenticated self-profile API

**Files:**
- Modify: `apps/api/src/modules/auth/auth.types.ts`
- Modify: `apps/api/src/modules/auth/auth.repository.ts`
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/modules/auth/auth.controller.ts`
- Modify: `apps/api/src/modules/auth/auth.routes.ts`
- Modify: `apps/api/tests/auth.repository.test.ts`
- Modify: `apps/api/tests/auth.service.test.ts`
- Modify: `apps/api/tests/auth.integration.test.ts`

**Interfaces:**
- `PublicUser` and `AuthUserRecord` expose `phoneNumber: string | null`.
- `PATCH /api/auth/me` accepts `{ name?: string; phoneNumber?: string | null }` and returns `{ data: { user: PublicUser } }`.
- The repository update is keyed only by the authenticated user ID and returns the updated user or `null` if the row is gone.

- [ ] **Step 1: Add failing repository, service, and endpoint tests.** Cover `GET /me` with a null phone and a saved phone; update name and phone; clear phone with `null`; reject an empty update and `email`, `role`, `password`, or `userId` fields; preserve a second user's record; and require a session (`401`). Assert rejected requests do not mutate the test user.
- [ ] **Step 2: Run focused auth tests and confirm the new assertions fail.** Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/auth.repository.test.ts tests/auth.service.test.ts tests/auth.schema.test.ts tests/auth.integration.test.ts`.
- [ ] **Step 3: Add phone mapping and the session-scoped update path.** Include `phone_number` in auth row mapping and `PublicUser`; add the parameterized repository update, service conversion to the public shape, controller handler, and `PATCH /me` route using `requireAuth` and body validation. Reject unsupported fields rather than silently stripping them.
- [ ] **Step 4: Add privacy regression assertions.** Extend the ride and pool integration tests plus driver request/active-pool/history integration tests to assert that phone numbers are absent from those response bodies.
- [ ] **Step 5: Run focused auth, ride, pool, and driver tests.** Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/auth.repository.test.ts tests/auth.service.test.ts tests/auth.schema.test.ts tests/auth.integration.test.ts tests/ride.integration.test.ts tests/pool.integration.test.ts tests/driver.integration.test.ts tests/active-pool.integration.test.ts`. Expected: PASS, with existing response contracts unchanged apart from the additive self-profile field.

### Task 3: Add the race-safe driver vehicle profile endpoint

**Files:**
- Modify: `apps/api/src/modules/driver/driver.types.ts`
- Modify: `apps/api/src/modules/driver/driver.schema.ts`
- Modify: `apps/api/src/modules/driver/driver.repository.ts`
- Modify: `apps/api/src/modules/driver/driver.service.ts`
- Modify: `apps/api/src/modules/driver/driver.controller.ts`
- Modify: `apps/api/src/modules/driver/driver.routes.ts`
- Modify: `apps/api/tests/driver.repository.test.ts`
- Modify: `apps/api/tests/driver.service.test.ts`
- Modify: `apps/api/tests/driver.integration.test.ts`
- Modify: `apps/api/vitest.db.config.ts`
- Create: `apps/api/tests/driver-profile.db.integration.ts` (DB-only naming keeps it out of the default unit suite; `vitest.db.config.ts` includes it)

**Interfaces:**
- Add `PATCH /api/driver/me/vehicle` with `{ name: string; capacity: number }`; success returns the current driver snapshot shape `{ isOnline, vehicle }`.
- The repository returns a discriminated outcome for updated, missing driver, missing active vehicle, or locked profile; the service maps these to success, `404 DRIVER_PROFILE_NOT_FOUND`, `404 ACTIVE_VEHICLE_NOT_FOUND`, or `409 VEHICLE_PROFILE_LOCKED`.
- The update transaction locks the driver row first, checks `is_online` and active pool status, then updates that driver's active vehicle and reads the returned snapshot.

- [ ] **Step 1: Write failing schema, repository, service, and route tests.** Cover valid vehicle name/capacity; capacity outside 1–4; `401` without a session; `403` for passengers; both 404 cases; online and offline-with-active-pool rejection with no writes; completed-pool allowance; and successful offline/no-active-pool update.
- [ ] **Step 2: Run focused driver tests and confirm the new endpoint behavior fails.** Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/driver.repository.test.ts tests/driver.service.test.ts tests/driver.integration.test.ts`.
- [ ] **Step 3: Implement the validated route and transaction.** Add a strict vehicle-update schema; inject the existing transaction-pool pattern into the driver repository; lock `drivers` by session user ID with `FOR UPDATE` before checking active pool rows or updating the active vehicle; map repository outcomes to the exact API errors; return the updated `{ isOnline, vehicle }` snapshot.
- [ ] **Step 4: Add a DB-backed lock-order regression test.** Configure the DB test runner to include the new driver profile integration test. With an isolated driver fixture, hold the driver row lock while an availability or acceptance operation waits; release it after changing the relevant state and assert the vehicle edit observes the new locked state and does not change vehicle data. Always clean up only the test fixture rows.
- [ ] **Step 5: Run driver unit/integration tests and the DB-backed tests.** Run the focused driver command above, then run `pnpm test:db` against the configured disposable test database after `pnpm db:setup`. Expected: PASS; no test uses the production Neon database.

### Task 4: Add typed web API methods

**Files:**
- Modify: `apps/web/src/lib/api/types.ts`
- Modify: `apps/web/src/lib/api/auth.ts`
- Modify: `apps/web/src/lib/api/driver.ts`
- Create: `apps/web/tests/profile-api.test.ts`

**Interfaces:**
- `PublicUser.phoneNumber` is `string | null`.
- Add `updateCurrentUser(input: { name?: string; phoneNumber?: string | null }): Promise<PublicUser>` using `PATCH /auth/me`.
- Add `updateDriverVehicle(input: { name: string; capacity: number }): Promise<DriverSnapshot>` using `PATCH /driver/me/vehicle`.

- [ ] **Step 1: Write failing API-wrapper tests.** Assert method, relative API path, JSON body, and parsed response for self-profile and driver-vehicle updates; include `phoneNumber: null`.
- [ ] **Step 2: Run the new tests and confirm the methods/types are missing.** Run: `pnpm --filter @dhaka-tesla-pool/web test -- tests/profile-api.test.ts`.
- [ ] **Step 3: Add the response type field and wrappers.** Reuse `apiRequest` so requests retain `credentials: "include"` and the existing `/api` rewrite behavior.
- [ ] **Step 4: Run the wrapper tests and web typecheck.** Run the focused command, then `pnpm --filter @dhaka-tesla-pool/web typecheck`. Expected: PASS, including existing `PublicUser` test fixtures updated with `phoneNumber: null` where needed.

### Task 5: Build passenger and driver profile screens

**Files:**
- Create: `apps/web/src/components/profile/profile-details-card.tsx`
- Create: `apps/web/src/components/profile/driver-vehicle-profile-card.tsx`
- Create: `apps/web/src/app/passenger/profile/page.tsx`
- Create: `apps/web/src/app/driver/profile/page.tsx`
- Test: `apps/web/tests/profile-pages.test.tsx`

**Interfaces:**
- `ProfileDetailsCard` loads and edits only the current user's name and optional phone; it displays email as read-only and maps a blank phone input to `null` when saving.
- `DriverVehicleProfileCard` reads the existing driver snapshot and active-pool endpoints; it enables vehicle editing only when offline and no active pool is present.

- [ ] **Step 1: Write failing profile component/page tests.** Cover initial loading, profile data display, email immutability, name/phone save, clearing the phone, validation/API errors, driver vehicle editing enabled only offline with no active pool, and an API `409 VEHICLE_PROFILE_LOCKED` message followed by a refresh of driver snapshot and active pool.
- [ ] **Step 2: Run the new UI tests and confirm the components/routes are missing.** Run: `pnpm --filter @dhaka-tesla-pool/web test -- tests/profile-pages.test.tsx`.
- [ ] **Step 3: Implement the shared personal-profile card and role pages.** Use the existing Input, Label, Card, Button, Alert, and Skeleton components. Keep profile errors local; redirect only for the existing unauthenticated-session error. The driver card must treat the server as authoritative and refresh both reads after a lock conflict.
- [ ] **Step 4: Run the profile-page tests.** Run the focused command. Expected: PASS, with passenger pages showing no vehicle editor and driver pages showing only their own vehicle fields.

### Task 6: Add role navigation, localization, and full verification

**Files:**
- Modify: `apps/web/src/components/layout/app-header.tsx`
- Modify: `apps/web/src/lib/i18n/messages.ts`
- Modify: `apps/web/tests/app-shell.test.tsx`
- Modify: `apps/web/tests/role-workspace.test.tsx`
- Modify: `apps/web/tests/i18n.test.tsx`

- [ ] **Step 1: Add failing navigation, access, and localization tests.** Assert the authenticated passenger header links to `/passenger/profile`, the driver header links to `/driver/profile`, the role guards redirect an opposite-role session, and all profile labels/messages render in English and Bangla.
- [ ] **Step 2: Run the focused tests and confirm the profile link and translations are missing.** Run: `pnpm --filter @dhaka-tesla-pool/web test -- tests/app-shell.test.tsx tests/role-workspace.test.tsx tests/i18n.test.tsx`.
- [ ] **Step 3: Add the role-aware profile link and matching English/Bangla message keys.** Preserve the current navigation layout and authenticated behavior; do not alter login/register screens or language persistence.
- [x] **Step 4: Run all API and web tests, typechecks, builds, and formatting checks.** `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed. The focused formatting check passed for newly authored TypeScript files; repository-wide `pnpm format:check` still reports 152 files, including pre-existing files across the repo, so unrelated legacy files were not reformatted. The DB-only suite still requires a running disposable local PostgreSQL instance.
- [ ] **Step 5: Verify migration application safely in development.** Run `pnpm db:setup` once against a local existing development database and once against a fresh disposable PostgreSQL database. Confirm migration 012 applies exactly once and existing user rows have `phone_number IS NULL`. Do not use these `db:setup` checks against production Neon.
- [ ] **Step 6: Prepare production schema before the API deploy.** With `DATABASE_URL` pointing to Neon, run only `pnpm db:migrate` from the feature branch and verify migration 012 is recorded before allowing the API deployment that reads `phone_number`. Do not print or commit the connection string.
- [x] **Step 7: Stop for the project owner's manual Git action.** No branch, stage, commit, push, or merge operations were performed. Report test results and suggest the single commit message `feat(profiles): add passenger and driver profile management`.

## Coverage Map

- Profile schema, migration order, and phone normalization: Task 1.
- Session-scoped GET/PATCH self-profile behavior and phone privacy: Task 2.
- Driver authorization, vehicle validation, active-pool restrictions, and transaction locking: Task 3.
- Cookie-authenticated frontend API contracts: Task 4.
- Profile loading, editing, error states, and stale-lock recovery: Task 5.
- Role access, navigation, English/Bangla copy, and release verification: Task 6.
