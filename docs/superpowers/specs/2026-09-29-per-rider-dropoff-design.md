# Per-Rider Drop-Off Design

## Purpose

Change pool completion from a single driver action into individual passenger
drop-offs. Pickup remains pool-wide: the driver marks the pool arrived and
starts the pool once, and those actions continue to transition every active
member ride together. After the pool starts, each passenger ride completes
independently when the driver drops that passenger off.

This branch must be completed before passenger pool history because the
passenger screen needs a correct per-rider completion state and timestamp.

## Scope

Add the authenticated driver-only endpoint:

```text
POST /api/driver/pools/:poolId/rides/:rideId/drop-off
```

The endpoint completes one ride at a time. It is valid only when the pool is
`STARTED`, the ride belongs to the driver's pool, the membership is active,
and the ride is `STARTED`.

The existing pool-level arrival and start actions remain. The existing
pool-level complete action is retained as a compatibility guard that returns
`409 POOL_COMPLETION_REQUIRES_DROPOFF` without writing; the driver API and UI
no longer use it.

The branch also adds a ride completion timestamp, updates the driver UI with a
drop-off action for each active passenger, and exposes the timestamp through
the existing passenger ride reads. It does not add passenger pool history,
WebSockets, or a separate membership status for successful drop-off.

## State Model

Pool status remains pool-wide:

```text
MATCHED -> DRIVER_ARRIVED -> STARTED -> COMPLETED
```

Before `STARTED`, arrival and start transition the pool and every active
member ride together. Once the pool is `STARTED`, member rides may be mixed:

```text
STARTED pool:
  Nusrat: STARTED
  Rafiq:  COMPLETED
```

Occupied seats are defined consistently everywhere as seats from an `ACTIVE`
pool membership whose linked ride status is not `COMPLETED`. Therefore
`MATCHED` and `DRIVER_ARRIVED` rides count toward capacity before the trip
starts, and a dropped-off `COMPLETED` ride stops counting afterward. A
completed ride remains attached to its membership for history and fare lookup.
The membership is not changed to `CANCELLED`, because drop-off is not
passenger cancellation.

When the last `STARTED` member is dropped off, the same transaction changes
the pool to `COMPLETED` and sets the pool completion timestamp. There is no
separate driver completion action.

The shared ride state machine continues to authorize `STARTED -> COMPLETED`.
The pool lifecycle mismatch guard for a started pool accepts member rides in
either `STARTED` or `COMPLETED`; the selected ride must specifically still be
`STARTED` before it can be dropped off.

## Completion Timestamps and Migration

Create a new migration:

```text
database/migrations/011_add_ride_completion_timestamp.sql
```

The migration will:

1. Add nullable `ride_requests.completed_at TIMESTAMPTZ`.
2. Backfill existing `COMPLETED` rides from their completed pool:

   ```sql
   UPDATE ride_requests AS r
   SET completed_at = p.completed_at
   FROM pool_memberships AS m
   JOIN pools AS p ON p.id = m.pool_id
   WHERE m.ride_request_id = r.id
     AND r.status = 'COMPLETED'
     AND r.completed_at IS NULL
     AND p.status = 'COMPLETED'
     AND p.completed_at IS NOT NULL;
   ```

3. Add the invariant:

   ```sql
   CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL))
   ```

The migration must not use `NOW()` as a fallback for historical data because
that would fabricate a completion time. If legacy data contains a completed
ride that cannot be joined to a completed pool timestamp, the final
constraint should fail visibly rather than silently corrupting history. The
current demo seeds contain no completed rides, so a fresh setup remains
valid.

The ride domain record and passenger response include `completedAt` for every
ride, with `null` until completion. A drop-off sets the ride timestamp with
the same database `NOW()` expression that changes its status.

## Drop-Off Transaction

`PoolRepository.dropOffRide` will execute one PostgreSQL transaction with the
same lock order used by acceptance, arrival, and start:

1. Lock the authenticated driver's profile row.
2. Lock the requested pool only when it belongs to that driver.
3. Lock all active memberships and their ride rows for the pool. The query
   includes member rides in all statuses so the mismatch guard can detect an
   unexpected state, and uses `FOR UPDATE OF m, r`.
4. Verify the pool is `STARTED`.
5. Verify every active member ride is either `STARTED` or `COMPLETED`.
6. Verify the requested ride is an active membership in that pool and is
   currently `STARTED`.
7. Update only the requested ride to `COMPLETED`, set `completed_at = NOW()`,
   and require `status = 'STARTED'` in the update predicate.
8. Insert exactly one `ride_status_events` row with the driver as actor,
   `STARTED` as `from_status`, and `COMPLETED` as `to_status`.
9. Count the remaining occupied memberships using the shared definition
   (`m.status = 'ACTIVE'` and linked ride status is not `COMPLETED`). In a
   `STARTED` pool, valid remaining rides are `STARTED`. If none remain, update
   the pool to `COMPLETED` and set `completed_at = NOW()`.
10. Return the updated pool summary and dropped ride timestamp, then commit.

The transaction never updates `pool_memberships.fare_poysha`. Fares remain
unchanged for both the first rider and later pooled riders.

For a non-final drop-off, occupancy counts only remaining active memberships
whose rides are not `COMPLETED`. With Bullet capacity 3 and one rider
remaining, the result is `occupiedSeats: 1` and `availableSeats: 2`. In every
such response:

```text
availableSeats = capacity - occupiedSeats
```

For the final drop-off, the returned pool status is `COMPLETED` and its
`completedAt` is set. The active-pool read subsequently returns no active
pool.

## API Contract

The success envelope is:

```json
{
  "data": {
    "pool": {
      "id": "pool-id",
      "status": "STARTED",
      "pickupZone": "Banani",
      "capacity": 3,
      "occupiedSeats": 1,
      "availableSeats": 2,
      "startedAt": "2026-09-29T14:00:00.000Z",
      "completedAt": null
    },
    "droppedOffRideId": "ride-id",
    "completedAt": "2026-09-29T14:30:00.000Z"
  }
}
```

On the final drop-off, `pool.status` is `COMPLETED`, `pool.completedAt` is
non-null, and `occupiedSeats` is zero because no active membership has a ride
status other than `COMPLETED`.
The driver response contains no passenger name, email, or passenger ID.

Public errors are:

| Status | Code | Condition |
| --- | --- | --- |
| 401 | `UNAUTHENTICATED` | No valid session. |
| 403 | `FORBIDDEN` | Session is not a driver. |
| 404 | `POOL_NOT_FOUND` | Pool is missing or belongs to another driver. |
| 404 | `RIDE_NOT_FOUND` | Ride is not an active member of that pool. |
| 409 | `INVALID_POOL_TRANSITION` | Pool is not `STARTED`. |
| 409 | `RIDE_NOT_STARTED` | The selected ride is already completed or otherwise not drop-off-ready. |
| 409 | `POOL_RIDE_STATE_MISMATCH` | Another active member has a state outside `STARTED` or `COMPLETED`. |
| 409 | `POOL_COMPLETION_REQUIRES_DROPOFF` | A client calls the deprecated pool-level complete action. |

The old pool-level complete endpoint performs no repository call and no
database write.

## Backend Architecture

The existing pools vertical slice remains the boundary:

```text
route -> controller -> service -> repository -> PostgreSQL
```

Add a `dropOff` method and result/outcome types to the pool module. The
service maps repository outcomes to the stable errors above and allocates the
status-event ID. The controller reads only the authenticated driver ID and
the two route parameters.

Extend ride read mapping with `completedAt` in:

- `RideRecord` and ride repository columns;
- passenger ride create, list, and detail responses; and
- the web `Ride` type.

The acceptance capacity query, driver active-pool read, and drop-off response
all use the same occupied-seat definition: `pool_memberships.status =
'ACTIVE'` joined to a ride whose status is not `COMPLETED`. No query may treat
the pool as empty merely because the trip has not reached `STARTED`.

## Driver UI

The coordinated `useDriverDashboard` hook remains the sole stateful
coordinator. Add a `dropOffRide(rideId)` action that uses the current pool ID,
marks one drop-off as pending, and refreshes waiting rides and the active pool
when the action settles.

The active-pool card will:

- show a `Drop off` button per member only when the pool is `STARTED`;
- disable all driver actions while a drop-off is pending;
- label the selected button as pending;
- remove the pool-level `Complete trip` button and its confirmation flow; and
- show the remaining active members after a partial drop-off, or the empty
  active-pool state after the final drop-off.

The existing five-second visible-tab polling and immediate post-action refresh
remain unchanged.

## Passenger UI

The existing `usePassengerRides` polling continues to call `GET /api/rides/:id`
while the ride is non-terminal. When a drop-off changes the ride to
`COMPLETED`, the hook updates the ride and refreshes the passenger list. The
current ride card disappears and ride history shows an explicit `Completed`
status. No WebSocket or new passenger endpoint is required.

## Verification

### Backend unit and HTTP tests

- Repository tests verify driver → pool → memberships/rides lock order.
- Dropping Rafiq first changes only Rafiq to `COMPLETED` and leaves the pool
  `STARTED`.
- The non-final response reports `occupiedSeats: 1` and
  `availableSeats: 2` for a three-seat Bullet with Nusrat remaining.
- Two `MATCHED` one-seat riders still occupy two seats, so a later two-seat
  request is rejected for capacity; the existing final-seat concurrency test
  remains green.
- Dropping Nusrat last completes the pool in the same transaction.
- Drop-off before start returns `INVALID_POOL_TRANSITION` without writes.
- Dropping the same rider twice returns `RIDE_NOT_STARTED` without a second
  event.
- Another driver's pool returns `POOL_NOT_FOUND`.
- Fares before and after both drop-offs are identical.
- Started-pool validation permits `STARTED` and `COMPLETED` member rides and
  rejects unexpected states without writes.
- Each successful drop-off writes exactly one status event.
- The pool-level complete route returns `POOL_COMPLETION_REQUIRES_DROPOFF`
  without writes.
- Unauthenticated and passenger sessions receive 401 and 403 respectively.

### PostgreSQL integration tests

Using the real Docker database, verify ride and pool statuses, ride and pool
completion timestamps, event counts, fares, active-seat counts, and the
`completed_at` status check after partial and final drop-off.

### Frontend tests

- Driver API calls the exact drop-off route.
- The driver hook serializes the action and refreshes after it settles.
- Drop-off buttons appear only after start and are pending/disabled correctly.
- The old completion action is absent.
- Passenger polling moves a dropped ride to `COMPLETED` history.
- Passenger history shows the ride completion time next to `Completed`.

## Commit Checkpoints

The user performs all Git operations manually. Stop after each checkpoint:

1. Backend commit: migration 011, ride completion mapping, drop-off endpoint,
   rejection of pool-level completion, backend tests, and API documentation.
2. Driver UI commit: drop-off API client, hook, reducer, card, and driver UI
   tests.
3. Passenger UI commit: completed timestamp type/read mapping, polling/history
   display, and passenger UI tests.

Suggested commit messages:

```text
feat(pool): add per-rider drop-off lifecycle
feat(driver): add per-rider drop-off controls
feat(passenger): show completed drop-offs
```

The feature branch is `feature/per-rider-dropoff`, based on the updated
`master` after the pooled-fare fix is merged.
