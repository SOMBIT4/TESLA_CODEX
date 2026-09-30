# Driver History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a privacy-safe driver history API and dashboard section for the
50 most recently completed pools, including final membership fares and
completion times.

**Architecture:** Keep history inside the existing pools vertical slice:
route → controller → service → repository → PostgreSQL. The repository will
select the driver's completed pools in a pool-level CTE before joining member
rows, so `LIMIT 50` applies to pools rather than members. The existing
`useDriverDashboard` hook will load history once and refresh it after actions,
while its five-second polling remains limited to waiting requests and the
active pool.

**Tech Stack:** Node.js, TypeScript, Express 5, PostgreSQL via `pg`, Next.js,
React, Tailwind CSS, local shadcn/ui-style components, Vitest, Supertest, and
React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-30-driver-history-design.md`

## Global Constraints

- `GET /api/driver/history` is driver-only and uses the existing HttpOnly cookie session.
- Return at most 50 completed pools, ordered by `completed_at DESC, id DESC`.
- Return only the authenticated driver's pools.
- Return passenger names only; never passenger email, passenger user ID, ride ID, or membership ID.
- Return active memberships whose linked rides are `COMPLETED` with non-null completion timestamps.
- Return the stored membership fare unchanged as the final fare.
- Do not add a migration unless implementation discovers a schema contradiction; the approved spec requires none.
- Do not poll history every five seconds; load once and refresh after actions settle.
- The user alone stages, commits, pushes, and merges.
- Stop for the user's manual commit after the backend checkpoint and again after the UI checkpoint.

## Review Focus

- A 50-pool limit must not truncate members from the 50th pool; Task 1's repository and database tests pin pool-level limiting.
- A completed pool with multiple members must keep all members grouped and ordered; Task 1's mapping test covers this.
- A driver must never see another driver's history or passenger identity fields; Task 2's HTTP tests cover ownership and privacy.
- A driver with no profile must receive `404 DRIVER_PROFILE_NOT_FOUND`, while a driver with no completed pools receives an empty list; Task 2 covers both.
- History must refresh after a drop-off without becoming another five-second poll; Task 3's hook tests cover post-action refresh and poll call counts.

---

### Task 1: Add the driver-history backend read model and repository query

**Files:**

- Modify: `apps/api/src/modules/pools/pool.types.ts`
- Modify: `apps/api/src/modules/pools/pool.repository.ts`
- Test: `apps/api/tests/pool.repository.test.ts`
- Test: `apps/api/tests/pool.db.integration.ts`

**Interfaces:**

- Produces `DriverHistoryMember` with `passengerName`, `pickupZone`,
  `destinationZone`, `seatsReserved`, `farePoysha`, and `completedAt`.
- Produces `DriverHistoryPool` with `id`, `pickupZone`, vehicle `name` and
  `capacity`, `startedAt`, `completedAt`, and `members`.
- Produces `DriverHistoryOutcome` with either
  `{ kind: "history", pools: DriverHistoryPool[] }` or
  `{ kind: "driver_profile_missing" }`.
- Adds `listDriverHistory(driverUserId: string): Promise<DriverHistoryOutcome>`
  to `PoolRepository`.

- [ ] **Step 1: Write failing repository and database tests**

Add a repository test that supplies rows for two completed pools and asserts
that the returned nested members preserve pool grouping, join order, final
`fare_poysha`, and both completion timestamps. Assert the query is scoped to
the authenticated driver and selects no passenger email/user/ride/membership
identity fields. Add a database regression with more than 50 completed pools,
multiple members on the 50th pool, one in-progress pool, one cancelled member,
and another driver's completed pool; expect exactly the newest 50 pools with
all valid members and no excluded rows.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
pnpm --filter @dhaka-tesla-pool/api test -- --run tests/pool.repository.test.ts
```

Expected: FAIL because the history types and repository method do not exist.

- [ ] **Step 3: Implement the history types and query**

Add the public/domain types and repository method. First resolve the driver's
profile by `users.id`/`drivers.user_id`; return `driver_profile_missing` when
there is no profile. Then use a completed-pools CTE ordered by
`p.completed_at DESC, p.id DESC` with `LIMIT 50`, and join only active
memberships, completed rides, vehicles, and passenger names. Map rows into
nested pools; do not expose raw SQL rows or identity columns in the result.

- [ ] **Step 4: Run focused and database tests and verify GREEN**

Run:

```powershell
pnpm --filter @dhaka-tesla-pool/api test -- --run tests/pool.repository.test.ts
$env:POOL_TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:15432/dhaka_tesla_pool'; pnpm --filter @dhaka-tesla-pool/api exec vitest --config vitest.db.config.ts --run tests/pool.db.integration.ts
```

Expected: repository tests and the real PostgreSQL history regression pass.

---

### Task 2: Expose the history endpoint and document the backend checkpoint

**Files:**

- Modify: `apps/api/src/modules/pools/pool.service.ts`
- Modify: `apps/api/src/modules/pools/pool.controller.ts`
- Modify: `apps/api/src/modules/pools/pool.routes.ts`
- Modify: `apps/api/tests/pool.service.test.ts`
- Modify: `apps/api/tests/pool.integration.test.ts`
- Modify: `apps/api/tests/auth-documentation.test.ts`
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`

**Interfaces:**

- Produces `PoolService.listDriverHistory(driverUserId: string): Promise<DriverHistoryPool[]>`.
- Produces `GET /api/driver/history` with `{ data: { pools: [...] } }`.
- Maps no session to `401`, passenger sessions to `403`, and missing driver
  profiles to `404 DRIVER_PROFILE_NOT_FOUND`.

- [ ] **Step 1: Write failing service and HTTP tests**

Add service mapping tests for history and missing driver profiles. Add HTTP
tests for no session, passenger authorization, missing profile, empty history,
newest-first pool ordering, own-history scoping, the 50-pool cap, completed
member/fare/timestamp fields, and the absence of passenger email, passenger
ID, ride ID, and membership ID. Add the `/api/driver/history` contract to the
documentation assertion.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
pnpm --filter @dhaka-tesla-pool/api test -- --run tests/pool.service.test.ts tests/pool.integration.test.ts tests/auth-documentation.test.ts
```

Expected: FAIL because the service method and route do not exist.

- [ ] **Step 3: Implement service, controller, and route**

Map repository outcomes to stable `AppError` values, serialize only the
approved public fields, and mount `GET /history` in the driver-only pool
router before any parameterized pool route. Keep the result successful with an
empty `pools` array when the driver has no completed pools.

- [ ] **Step 4: Update backend documentation**

Document the endpoint, ordering, 50-pool limit, final fare meaning, privacy
boundary, empty response, and the next UI checkpoint in `README.md` and
`docs/PROJECT_STATUS.md`. Keep the approved design and plan paths referenced.

- [ ] **Step 5: Run backend verification and stop for manual commit**

Run:

```powershell
pnpm --filter @dhaka-tesla-pool/api test
pnpm --filter @dhaka-tesla-pool/api lint
pnpm --filter @dhaka-tesla-pool/api build
git diff --check
```

Expected: all API tests, TypeScript checks, build, and whitespace validation
pass. Stop without staging or committing and report:

```text
feat(driver): expose completed pool history
```

The user manually commits and pushes the backend checkpoint before UI work.

---

### Task 3: Add the typed web client and coordinated history refresh

**Files:**

- Modify: `apps/web/src/lib/api/types.ts`
- Modify: `apps/web/src/lib/api/driver.ts`
- Modify: `apps/web/src/hooks/use-driver-dashboard.ts`
- Test: `apps/web/tests/driver-api.test.ts`
- Test: `apps/web/tests/use-driver-dashboard.test.tsx`
- Test: `apps/web/tests/driver-dashboard-reducer.test.ts`

**Interfaces:**

- Produces web `DriverHistoryMember` and `DriverHistoryPool` types using
  serialized string timestamps.
- Produces `getDriverHistory(): Promise<DriverHistoryPool[]>` calling exactly
  `/api/driver/history`.
- Extends `DriverDashboardState` with `history: DriverHistoryPool[]` and
  exposes `refreshHistory(): Promise<void>` from `useDriverDashboard`.

- [ ] **Step 1: Write failing client, reducer, and hook tests**

Assert the exact API path and credentials, history is loaded once on mount,
the reducer stores it without affecting operational polling, and a completed
drop-off refreshes history after the action settles. Advance five-second fake
timers and assert history is not requested by the recurring operational poll.
Assert concurrent history refreshes do not overlap and a failed refresh keeps
the last successful history visible.

- [ ] **Step 2: Run the focused web tests and verify RED**

Run:

```powershell
pnpm --filter @dhaka-tesla-pool/web test -- tests/driver-api.test.ts tests/use-driver-dashboard.test.tsx tests/driver-dashboard-reducer.test.ts
```

Expected: FAIL because the history client, state, and refresh action do not
exist.

- [ ] **Step 3: Implement the typed client and hook state**

Add the wrapper and reducer state. Load history during the initial dashboard
effect, refresh it in the action `finally` path alongside operational data,
and keep it out of the five-second polling function. Preserve the existing
no-overlap, hidden-tab, 401, and pending-action behavior.

- [ ] **Step 4: Run focused web tests and verify GREEN**

Run the focused command from Step 2. Expected: all client, reducer, and hook
tests pass.

---

### Task 4: Render driver history and verify the UI checkpoint

**Files:**

- Create: `apps/web/src/components/driver/driver-history.tsx`
- Modify: `apps/web/src/components/driver/driver-dashboard.tsx`
- Test: `apps/web/tests/driver-history.test.tsx`
- Modify: `apps/web/tests/driver-dashboard.test.tsx`

**Interfaces:**

- Consumes `history` from `useDriverDashboard` and renders only the approved
  `DriverHistoryPool` fields.
- Produces an accessible empty state and completed-pool/member cards with
  formatted final fares and completion times.

- [ ] **Step 1: Write failing component and dashboard tests**

Assert the empty state, newest-first pool display, vehicle and route details,
Nusrat/Rafiq final fares, member completion time, and absence of email or any
ID strings. Assert the dashboard includes history below operational content
without adding another polling endpoint.

- [ ] **Step 2: Implement the presentational history card**

Create a presentational component with existing Card, Badge, and formatting
primitives. Use semantic `time` elements, format poysha with the existing
money helper, and keep passenger identity limited to the supplied name.
Render history from the hook in the driver dashboard.

- [ ] **Step 3: Run the complete workspace verification and stop for manual commit**

Run:

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: API and web tests, type checks, lint, production builds, and
whitespace validation pass. Exclude generated `apps/web/next-env.d.ts` if a
Next build changes it. Stop without Git operations and report:

```text
feat(driver): show completed pool history
```

The user manually commits, pushes, and merges the completed feature branch.
