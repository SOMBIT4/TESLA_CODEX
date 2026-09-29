# Driver Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the protected driver placeholder with a live, privacy-safe
Bullet operations dashboard for availability, waiting-request acceptance, active
pool visibility, and lifecycle control.

**Architecture:** A typed `lib/api/driver.ts` boundary consumes the existing
same-origin API. `useDriverDashboard` is the single imperative coordinator for
fetches, polling, visibility, and mutations, while its pure exported reducer
owns all dashboard state transitions. Presentational driver components render
the reducer state and invoke the hook's actions without directly fetching.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS,
shadcn-style local UI components, Lucide, Vitest, and React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-29-driver-frontend-design.md`

## Global Constraints

- Use relative `/api/...` requests only through `apiRequest`, with the existing
  HttpOnly cookie and Next.js server-side proxy; never add `NEXT_PUBLIC_API_URL`
  or browser token storage.
- This is frontend-only: no Express route, migration, database, Docker, or
  backend authorization changes.
- Do not add TanStack Query or another query library.
- Use Dhaka Tesla Pool/Bullet text identity only; never add Tesla's logo,
  logo-like glyphs, or wordmark styling.
- Requests and active pool poll every 5 seconds only while the tab is visible;
  `GET /api/driver/me` loads only once on mount, while its status-toggle POST
  response updates the snapshot directly.
- Prevent overlapping refreshes, pause refreshes through every pending action,
  wait for an existing refresh before an action request, refresh operations
  after every action result, and clean up timer/listener work on unmount.
- Map known accept `409`s by API error code and preserve the server message for
  unknown codes; refresh requests and active pool after every accept result.
- Active-pool UI may render only member name, route, seats, and fare—never
  passenger email or passenger ID. Do not invent driver history.
- Completion requires an in-card confirmation; other lifecycle actions are
  direct.
- Never stage, commit, push, merge, switch, delete, or otherwise mutate Git.
  The user makes one manual feature commit; exclude generated
  `apps/web/next-env.d.ts` if a build changes it.

## Review Focus

- A hidden tab must make zero network calls until it becomes visible, then make
  one operational refresh; test in Task 3.
- A slow poll followed by a mutation must serialize rather than overlap; test
  with deferred promises in Task 3.
- `POOL_FULL` and an unknown accept `409` must respectively show the specified
  friendly copy and unchanged server message; test in Task 3.
- An active `DRIVER_ARRIVED` or `STARTED` pool must block accept controls while
  retaining the valid lifecycle control; test in Task 4.
- Completion must not send its request until the driver confirms it; test in
  Task 4.

---

## File Structure

- `apps/web/src/lib/api/types.ts`: driver, waiting-ride, active-pool, and pool
  mutation response types, limited to data the API permits the UI to render.
- `apps/web/src/lib/api/driver.ts`: typed wrappers for all existing driver and
  pool endpoints.
- `apps/web/src/lib/format/money.ts`: existing passenger formatter plus a
  non-breaking exact-two-decimal `formatTaka` formatter for pool fares.
- `apps/web/src/hooks/use-driver-dashboard.ts`: exported pure reducer plus the
  coordinated data/polling/action hook.
- `apps/web/src/components/driver/driver-dashboard.tsx`: protected-workspace
  orchestration, loading/error/empty states, and expired-session redirect.
- `apps/web/src/components/driver/driver-availability-card.tsx`: vehicle and
  online/offline control.
- `apps/web/src/components/driver/waiting-requests.tsx`: identity-free queue
  and acceptance controls.
- `apps/web/src/components/driver/active-pool-card.tsx`: pool/member display,
  lifecycle action, and completion confirmation.
- `apps/web/src/app/driver/page.tsx`: replaces the placeholder with the
  driver-dashboard entry point under the existing role guard.
- `apps/web/tests/driver-api.test.ts`: API-wrapper request paths/envelopes.
- `apps/web/tests/driver-dashboard-reducer.test.ts`: no-timer, no-network pure
  reducer tests.
- `apps/web/tests/use-driver-dashboard.test.tsx`: hook polling, action,
  conflict, visibility, and cleanup tests.
- `apps/web/tests/driver-dashboard.test.tsx`: component states, active-pool
  privacy/fare display, action disabling, and completion confirmation.
- `README.md`, `docs/PROJECT_STATUS.md`, and
  `apps/api/tests/auth-documentation.test.ts`: driver workspace documentation
  and the existing documentation assertion.

### Task 1: Add typed driver API wrappers

**Files:**
- Modify: `apps/web/src/lib/api/types.ts`
- Create: `apps/web/src/lib/api/driver.ts`
- Test: `apps/web/tests/driver-api.test.ts`

**Interfaces:**
- Consumes: `apiRequest<T>(path, options)` from `lib/api/client.ts`.
- Produces: `getDriverSnapshot(): Promise<DriverSnapshot>`,
  `setDriverOnlineStatus(isOnline: boolean): Promise<DriverSnapshot>`,
  `listWaitingRides(): Promise<WaitingRide[]>`,
  `getActivePool(): Promise<DriverActivePool | null>`,
  `acceptRide(rideId: string): Promise<PoolAcceptance>`, and
  `transitionPool(poolId: string, action: PoolLifecycleAction): Promise<PoolLifecycleTransition>`.

- [ ] **Step 1: Write failing API-wrapper tests**

Assert each wrapper uses its exact relative path and method, list requests
unwraps `{ rides }`, active-pool permits `null`, and status sends
`{ isOnline: boolean }`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --filter @dhaka-tesla-pool/web test -- tests/driver-api.test.ts`

Expected: FAIL because `lib/api/driver.ts` and the driver response types do
not exist.

- [ ] **Step 3: Add the minimal public driver types and wrappers**

Keep `DriverActivePoolMember` restricted to `passengerName`, route, seats, and
fare. Map the three lifecycle action names to the existing `arrive`, `start`,
and `complete` endpoint suffixes. Do not expose or add email/passenger-ID
properties.

- [ ] **Step 4: Run the focused API-wrapper test**

Run: `pnpm --filter @dhaka-tesla-pool/web test -- tests/driver-api.test.ts`

Expected: PASS.

### Task 2: Establish the pure dashboard reducer

**Files:**
- Create: `apps/web/src/hooks/use-driver-dashboard.ts`
- Test: `apps/web/tests/driver-dashboard-reducer.test.ts`

**Interfaces:**
- Consumes: `DriverSnapshot`, `WaitingRide`, and `DriverActivePool` from Task
  1.
- Produces: `DriverDashboardState`, `DriverDashboardAction`,
  `initialDriverDashboardState`, and
  `driverDashboardReducer(state, action): DriverDashboardState` for Task 3.

- [ ] **Step 1: Write failing reducer tests**

Cover initial loading, snapshot load, paired requests/pool load, action
pending/clear, status update, and a failed refresh preserving known data while
recording a message. Assert reducer calls have no browser/timer/network
dependencies.

- [ ] **Step 2: Run the reducer test to verify it fails**

Run: `pnpm --filter @dhaka-tesla-pool/web test -- tests/driver-dashboard-reducer.test.ts`

Expected: FAIL because the reducer exports do not exist.

- [ ] **Step 3: Implement the discriminated pure reducer**

Model `pendingAction` as `"toggle-status" | "accept" | "arrive" | "start" |
"complete" | null`, retain last good requests/pool on errors, and carry an
`isUnauthenticated` flag for the dashboard to redirect.

- [ ] **Step 4: Run the reducer test**

Run: `pnpm --filter @dhaka-tesla-pool/web test -- tests/driver-dashboard-reducer.test.ts`

Expected: PASS.

### Task 3: Implement coordinated polling and driver actions

**Files:**
- Modify: `apps/web/src/hooks/use-driver-dashboard.ts`
- Test: `apps/web/tests/use-driver-dashboard.test.tsx`

**Interfaces:**
- Consumes: all Task 1 wrappers and Task 2 reducer exports.
- Produces: `useDriverDashboard()` returning state plus
  `toggleStatus()`, `acceptRide(rideId)`, `arrive(poolId)`, `start(poolId)`,
  `complete(poolId)`, and `refreshOperations()` for Task 4.

- [ ] **Step 1: Write failing hook tests**

Use mocked driver API wrappers, fake timers, and deferred promises to assert:

- initial load reads status once plus requests/pool once;
- a 5-second tick reads only requests/pool and never overlaps an in-flight
  refresh;
- a status toggle updates the snapshot from its POST response without another
  status GET;
- pending toggle/accept/lifecycle actions pause polling and disabled state is
  observable until settlement;
- actions wait for a current refresh, then refresh requests/pool immediately
  after success or failure;
- `POOL_FULL` becomes "Not enough seats left in Bullet" and an unknown `409`
  keeps its API message, with both cases refreshing requests/pool;
- hidden tabs pause work, visible tabs refresh once then resume; and
- unmount clears the interval/listener and prevents further polls.

- [ ] **Step 2: Run the hook test to verify it fails**

Run: `pnpm --filter @dhaka-tesla-pool/web test -- tests/use-driver-dashboard.test.tsx`

Expected: FAIL because the hook has not implemented the scheduling/action
contract.

- [ ] **Step 3: Implement `useDriverDashboard` with one refresh gate**

Use refs for mounted state, document visibility, current refresh promise, and
the interval ID. Fetch requests and active pool together in one
`refreshOperations` operation. Serialize mutations behind any active refresh,
dispatch reducer-only state transitions, map only known accept conflict codes,
and always invoke the immediate operational refresh in action cleanup.

- [ ] **Step 4: Run the focused hook and reducer tests**

Run: `pnpm --filter @dhaka-tesla-pool/web test -- tests/use-driver-dashboard.test.tsx tests/driver-dashboard-reducer.test.ts`

Expected: PASS.

### Task 4: Build the protected driver workspace and components

**Files:**
- Create: `apps/web/src/components/driver/driver-dashboard.tsx`
- Create: `apps/web/src/components/driver/driver-availability-card.tsx`
- Create: `apps/web/src/components/driver/waiting-requests.tsx`
- Create: `apps/web/src/components/driver/active-pool-card.tsx`
- Modify: `apps/web/src/app/driver/page.tsx`
- Modify: `apps/web/src/lib/format/money.ts`
- Modify: `apps/web/tests/role-workspace.test.tsx`
- Modify: `apps/web/tests/ride-format.test.ts`
- Test: `apps/web/tests/driver-dashboard.test.tsx`

**Interfaces:**
- Consumes: `useDriverDashboard()` from Task 3, `formatTaka()` from the money
  formatter, and local `Alert`, `Badge`, `Button`, `Card`, and `Skeleton`
  components.
- Produces: an actual `/driver` workspace protected by the existing
  `SessionGuard`.

- [ ] **Step 1: Write failing component and page tests**

Assert loading/error/empty states; missing-vehicle and online/offline controls;
an offline queue with disabled acceptance; pending-disabled controls;
identity-free waiting requests; matched pool member content; Nusrat at
`71.00 Tk` and Rafiq at `59.00 Tk`; arrival/start/complete action selection;
blocked acceptance for arrived/started pools; and confirmation before
completion sends its request. Add a formatter test for the exact two-decimal
Taka labels without changing existing `formatPoysha` behavior. Update role
tests to expect the dashboard rather than placeholder copy.

- [ ] **Step 2: Run component tests to verify they fail**

Run: `pnpm --filter @dhaka-tesla-pool/web test -- tests/driver-dashboard.test.tsx tests/role-workspace.test.tsx`

Expected: FAIL because the driver workspace components do not exist.

- [ ] **Step 3: Implement presentational driver components and page**

Use the hook's `pendingAction` to disable every mutation button. Render
available seats as capacity minus occupied seats. The active member list uses
only its typed permitted fields. The Complete control first opens inline
confirmation copy with Cancel and Confirm completion actions; only Confirm
calls `complete(poolId)`. Add `formatTaka(poysha: number): string` returning
two-decimal text such as `71.00 Tk` without changing `formatPoysha`.

- [ ] **Step 4: Run focused component tests**

Run: `pnpm --filter @dhaka-tesla-pool/web test -- tests/driver-dashboard.test.tsx tests/role-workspace.test.tsx`

Expected: PASS.

### Task 5: Document the driver workspace and verify the branch

**Files:**
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `apps/api/tests/auth-documentation.test.ts`
- Test: `apps/api/tests/auth-documentation.test.ts`

**Interfaces:**
- Consumes: completed dashboard behavior from Tasks 1–4.
- Produces: accurate usage, polling, privacy, one-hook rationale, TanStack
  Query switch criteria, and the user-owned manual checkpoint.

- [ ] **Step 1: Write failing documentation expectations**

Require the README to mention the driver workspace, 5-second visible-tab
refresh, active-pool privacy, coordinated-hook rationale, and conditions that
would justify TanStack Query. Require project status to name
`feature/driver-frontend` and its intended manual commit, while leaving any
unselected follow-up branch clearly deferred rather than inventing roadmap
work.

- [ ] **Step 2: Run the documentation test to verify it fails**

Run: `pnpm --filter @dhaka-tesla-pool/api test -- --run tests/auth-documentation.test.ts`

Expected: FAIL because the driver frontend is not documented.

- [ ] **Step 3: Document the implementation**

Update the README and project status without claiming browser tokens, direct
Express access, driver history, or unavailable API fields. State that the user
performs the final Git commit, push, and merge.

- [ ] **Step 4: Run scoped and full verification**

Run:
`pnpm --filter @dhaka-tesla-pool/api test -- --run tests/auth-documentation.test.ts`

Then run:
`pnpm test`
`pnpm typecheck`
`pnpm build`
`pnpm exec prettier --check <all changed files>`

Expected: all commands exit successfully. If build regenerates
`apps/web/next-env.d.ts`, leave it unstaged for the user's manual cleanup.
