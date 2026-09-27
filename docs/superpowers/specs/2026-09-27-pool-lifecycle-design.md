# Pool Lifecycle Design

## Purpose

Complete the driver-controlled lifecycle of an active Tesla pool. The assigned
driver can mark a matched pool as arrived, start it, and complete it. Each
action must keep the pool and every active member ride in the same lifecycle
state and append durable, per-ride audit events.

This feature also closes a correctness gap in pool acceptance: only a
`MATCHED` pool may accept another ride. A pool that has reached
`DRIVER_ARRIVED` or `STARTED` must never accept another ride.

## Scope

Add three authenticated driver-only endpoints beneath the existing driver API
namespace:

```text
POST /api/driver/pools/:poolId/arrive
POST /api/driver/pools/:poolId/start
POST /api/driver/pools/:poolId/complete
```

No request body is accepted. The authenticated session supplies the driver
identity and the route parameter supplies the pool ID. A successful response
uses the existing envelope and returns the transitioned pool summary and the
IDs of rides transitioned with it; it never returns passenger names, emails,
or passenger IDs.

This feature deliberately does not add a pool-detail/history read or extend
passenger cancellation after matching. Releasing a matched membership safely
is separate work because it affects capacity and empty-pool handling.

## Lifecycle Rules

The pool and every active member ride advance together through the following
linear state machine:

```text
MATCHED -> DRIVER_ARRIVED -> STARTED -> COMPLETED
```

The pure ride state-machine module is the authority for all ride transitions,
including the existing `REQUESTED -> CANCELLED` passenger cancellation. The
existing cancellation endpoint continues to allow cancellation only from
`REQUESTED` for now, but it must call that shared state-machine module rather
than duplicate its transition rule. Invalid, repeated, skipped, or reversed
driver actions are rejected with `409 INVALID_POOL_TRANSITION`.

`STARTED` is the fare-lock boundary. This branch does not update membership
fares at any lifecycle step. It also changes matching so a driver who already
has a `DRIVER_ARRIVED` or `STARTED` pool receives `409 POOL_NOT_ACCEPTING`
when attempting to accept another ride; the database's one-active-pool
constraint must not be worked around by creating a second pool. Once a pool
is `COMPLETED`, it no longer occupies the active-pool constraint, so the
driver may accept a new request into a new `MATCHED` pool.

## Transaction and Authorization

Each driver action is one PostgreSQL transaction:

1. Lock the authenticated driver's profile row. A driver-role user without a
   profile receives `404 DRIVER_PROFILE_NOT_FOUND`.
2. Lock the requested pool only when it belongs to that profile. A missing or
   other driver's pool returns `404 POOL_NOT_FOUND`, preventing cross-driver
   discovery or mutation.
3. Verify the pool has the operation's exact expected status.
4. Lock all `ACTIVE` memberships and their ride rows. Every locked ride must
   have the same expected status as the pool; otherwise return
   `409 POOL_RIDE_STATE_MISMATCH` without writing a partial transition.
5. Update the pool status. Set `started_at` only for `STARTED` and
   `completed_at` only for `COMPLETED`.
6. Update every active member ride with the same target status and append one
   `ride_status_events` row per ride, with the pool ID and the driver user ID.
7. Commit; any error rolls back all pool, ride, and event writes.

Pool acceptance follows that same lock order: driver's profile row, then any
active pool, then the requested ride row. The driver-row lock serializes
same-driver acceptance and lifecycle operations; the shared order prevents
accept, arrival, and start operations from interleaving into inconsistent
pool/ride states.

Being online and retaining an active vehicle are intentionally required to
accept a new ride, not to advance an already accepted pool. A driver who goes
offline must still be able to finish an existing trip.

## Public Errors

| Status | Code | Condition |
| --- | --- | --- |
| 401 | `UNAUTHENTICATED` | No valid session. |
| 403 | `FORBIDDEN` | Session is not a driver. |
| 404 | `DRIVER_PROFILE_NOT_FOUND` | Driver-role user has no driver profile. |
| 404 | `POOL_NOT_FOUND` | Pool does not exist or is not owned by the driver. |
| 409 | `INVALID_POOL_TRANSITION` | Action does not match the current pool state. |
| 409 | `POOL_RIDE_STATE_MISMATCH` | Defensive guard: an active member ride no longer matches the pool state. |
| 409 | `POOL_NOT_ACCEPTING` | Driver attempts to accept while their active pool is arrived or started. |

## Architecture

The existing `modules/pools` vertical slice gains lifecycle route, controller,
service, repository, types, and tests. The repository owns transactional SQL;
the service maps repository outcomes to stable `AppError` values and allocates
status-event IDs. Routes retain the existing `requireAuth` and
`requireRole("DRIVER")` middleware.

Add `modules/rides/ride-state-machine.ts` as a pure, database-free mapping of
allowed ride transitions. Lifecycle services use it before issuing writes so
the documented state machine cannot silently diverge from driver operations.

## Verification

Tests must prove:

- the ride state machine allows only the documented transitions;
- each action updates the driver-owned pool, all active rides, and one event
  per ride in one transaction;
- `started_at` and `completed_at` are written only by their respective steps;
- arrival, start, and completion work in sequence, while repeated, skipped,
  and reversed actions return `INVALID_POOL_TRANSITION`;
- no session, a passenger session, missing driver profile, and another
  driver's pool are rejected correctly;
- lifecycle responses omit passenger identity; and
- accepting a ride into either a `DRIVER_ARRIVED` or `STARTED` pool returns
  `POOL_NOT_ACCEPTING` and writes no membership or status event; and
- after a pool is `COMPLETED`, an online driver with an active vehicle can
  accept another ride into a new `MATCHED` pool.

The existing database-free suite remains the default check. `pnpm test:db`
continues to verify the real PostgreSQL final-seat race when Docker Desktop is
running and `POOL_TEST_DATABASE_URL` is configured.

## Documentation

Update the README and project status to document the three lifecycle actions,
the status flow, fare-lock boundary, the started-pool acceptance rejection,
and the next recommended feature branch. Git staging, commits, pushes, and
merges remain exclusively manual user actions.
