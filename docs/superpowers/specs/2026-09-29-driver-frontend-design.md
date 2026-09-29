# Driver Frontend Design

## Purpose

Replace the protected `/driver` placeholder with Bullet's operational driver
workspace. A signed-in driver can see their vehicle and availability, review
the real waiting-request queue, accept compatible rides, inspect the active
pool, and progress its lifecycle without a page reload.

This branch is frontend-only. It consumes the existing same-origin API proxy
and secure HttpOnly session cookie; it does not add database migrations,
Express routes, browser token storage, WebSockets, driver history, or vehicle
management.

## API Contract

All browser requests use the existing `apiRequest` helper and therefore
relative `/api/...` URLs with `credentials: "include"`.

| Need | Endpoint | When used |
| --- | --- | --- |
| First-load availability and vehicle | `GET /api/driver/me` | Once when the dashboard mounts. |
| Availability update | `POST /api/driver/status` | When the driver toggles online/offline. |
| Waiting queue | `GET /api/driver/requests` | Initial operational load, 5-second poll, visibility resume, and post-action refresh. |
| Active pool | `GET /api/driver/pools/active` | Initial operational load, 5-second poll, visibility resume, and post-action refresh. |
| Claim a ride | `POST /api/driver/requests/:rideId/accept` | Driver presses Accept. |
| Pool lifecycle | `POST /api/driver/pools/:poolId/arrive`, `/start`, `/complete` | The action valid for the current pool status. |

The UI treats Express as the authorization and state-transition authority. It
uses local state only to communicate current server data and prevent accidental
duplicate clicks; it never calculates capacity, fare, compatibility, or valid
transitions itself.

## Screen and Components

`apps/web/src/app/driver/page.tsx` remains protected by `SessionGuard` with
the `DRIVER` role and renders `DriverDashboard`.

`DriverDashboard` owns the page layout and uses focused presentational
components:

- `DriverAvailabilityCard`: Bullet vehicle details, online/offline state, and
  the availability toggle.
- `WaitingRequests`: the server-provided, identity-free request queue, with
  route, requested seats, solo estimate, and one Accept button per ride.
- `ActivePoolCard`: active-pool status, vehicle capacity, occupied and
  available seats, each member's name, pickup-to-destination route, reserved
  seats, and membership fare, plus the one applicable lifecycle action. It
  never renders an email address or passenger ID.

The visual language follows the passenger workspace: responsive cards,
Tailwind/shadcn primitives, accessible labels and status text, concise error
alerts, and Dhaka Tesla Pool/Bullet text identity only. It must not use
Tesla's logo, logo-like marks, or wordmark styling.

The queue remains visible while the driver is offline but acceptance is
disabled with a clear availability explanation. An active pool can still show
its lifecycle action while offline because lifecycle authorization belongs to
the API and does not require an online driver. If the active pool is
`DRIVER_ARRIVED` or `STARTED`, queue accept buttons are disabled because the
current pool cannot accept a further ride; server validation remains the final
guard against races.

Completing a trip uses a brief in-card confirmation before the final request.
Arrival and start remain direct actions because each can still be advanced by
the following lifecycle control.

The dashboard explicitly renders loading, empty, error, and success states:

- Initial loading: a labelled workspace loading state.
- No active pool: an honest "No active pool" panel.
- No waiting requests: a queue-empty message.
- Failed operational read/action: an alert while retaining the last known
  data when possible.
- Missing vehicle: an availability explanation; going online is unavailable
  until the backend has an active vehicle.

## Coordinated Data Hook

`useDriverDashboard` is the sole stateful data coordinator. It replaces the
need for separate driver-status, request-queue, and active-pool hooks, which
would otherwise each own timers, visibility listeners, stale data, and action
invalidation independently.

It exposes driver snapshot, waiting requests, active pool, loading/error
state, the current pending action, and the five driver actions. Its state
changes are performed only by an exported pure `driverDashboardReducer` and
discriminated action types. The reducer has no timers, network calls, router
calls, or DOM access, so it can be unit-tested directly.

`lib/api/driver.ts` holds typed API wrappers. `lib/api/types.ts` gains only the
response types required by these existing APIs: driver snapshot, vehicle,
waiting ride, active pool/member, pool status, and lifecycle summary.

## Refresh, Visibility, and Action Rules

The hook keeps imperative coordination in refs and all view state in the
reducer.

1. On mount, it fetches driver status once and makes one operational refresh
   for waiting requests plus active pool. It does not poll driver status.
2. While the document is visible, a 5-second interval requests only waiting
   requests and active pool. A single in-flight-refresh promise/ref prevents
   overlapping polls.
3. `visibilitychange` pauses polling immediately when hidden. On becoming
   visible, it performs one operational refresh and then resumes the regular
   interval. All listeners and timers are removed on unmount.
4. Before an action begins, the reducer records its pending action so every
   action button becomes disabled. New polling is skipped. If a poll is
   already in flight, the action waits for it to settle before sending its
   mutation, preventing an action and a poll from racing each other.
5. After every accept, lifecycle action, or availability-toggle result,
   whether successful or failed, the hook immediately refreshes waiting
   requests and active pool. The successful status-toggle response also
   updates the snapshot directly; no additional `GET /api/driver/me` occurs.
6. After every action settles, pending state clears and polling may resume.
   An `UNAUTHENTICATED` API error redirects to `/login`; other errors remain
   visible as an alert.
7. An accept `409` maps its API error code to a friendly message before the
   immediate refresh: `POOL_FULL` becomes "Not enough seats left in Bullet";
   `RIDE_NOT_COMPATIBLE` becomes "This ride doesn't match the current pool
   route"; `POOL_NOT_ACCEPTING` becomes "This pool can't take new rides after
   arrival"; and `RIDE_ALREADY_MATCHED` becomes "That request is no longer
   available". Unknown `409` codes keep the server's message as their safe
   fallback. Both waiting requests and the active pool refresh regardless of
   the mutation outcome.

The hook does not start a second interval after visibility changes, and it
does not write state after unmount.

## Testing

Web tests use Vitest and React Testing Library with mocked API wrappers.

- Reducer tests cover initial data, operational refresh, action pending/clear,
  successful status mutation, and preserved data plus error state.
- Hook tests with fake timers verify the 5-second schedule only reads requests
  and active pool after first load; driver status is not re-read by polling.
- Deferred API promises verify no overlapping poll and no polling while an
  accept, lifecycle, or availability action is pending.
- An accept `409` test verifies friendly feedback and an immediate refresh of
  requests and active pool, including the `POOL_FULL` message and an unknown
  code falling back to the server message.
- Visibility tests verify hidden-tab pause and one refresh on return.
- Unmount tests verify interval/listener cleanup and no further polling.
- Dashboard/component tests verify loading, empty, error, disabled-action,
  active-pool, and lifecycle-action states.
- Existing role-routing tests are updated to assert the real driver workspace
  instead of the placeholder.

## Documentation

The README will document the driver workspace, supported actions, polling
behavior, and privacy boundary. It will also explain the coordinated-hook
choice: one dashboard currently owns three tightly related resources and their
shared mutation/polling policy. Separate hooks would duplicate synchronization
logic; TanStack Query would be worthwhile later if several screens need shared
server caching, mutation invalidation, retries, pagination, or background
refetch policy beyond this one focused dashboard.

`docs/PROJECT_STATUS.md` will record the branch's manual checkpoint after
implementation. Any follow-up feature branch remains explicitly deferred until
the user selects it, rather than inventing roadmap work. Git staging, commits,
pushes, pull requests, and merges remain solely the user's actions.

## Acceptance Criteria

- A driver sees real data from the existing API and can operate the complete
  availability, acceptance, active-pool, and lifecycle flow.
- Requests and active pool refresh every five seconds only while visible, with
  no overlapping poll, no polling during an action, an immediate post-action
  refresh, and complete unmount cleanup.
- The UI displays no passenger email or passenger ID and does not invent
  unavailable driver history.
- A conflicted accept shows error-code-specific friendly feedback and refreshes
  live data; unknown conflict codes preserve the server message.
- When Nusrat and Rafiq share Bullet, the active-pool card renders their
  respective membership fares as `71.00 Tk` and `59.00 Tk` alongside their
  names, routes, and seats.
- Completing a trip requires an explicit in-card confirmation.
- Reducer, hook, component, full workspace test, typecheck, and production
  build checks pass before the user manually commits this branch.
