# Tesla Pooling Design

## Purpose

Add the MVP's core, driver-initiated pooling operation. An authenticated,
online driver accepts one waiting ride; the system creates or reuses one
compatible pool, reserves seats without overbooking, locks the ride's pooled
fare, and records the `REQUESTED` to `MATCHED` transition atomically.

This feature is intentionally backend-only. It establishes the correctness
boundary that later driver and passenger UI work will consume.

## Scope

The feature adds one driver-only endpoint:

```text
POST /api/driver/requests/:rideId/accept
```

The endpoint has no request body. The authenticated driver's identity comes
from the session and `rideId` comes from the URL.

It may create a first pool for the driver or add the requested ride to the
driver's compatible active pool. Compatibility is deterministic: a ride can
join only when its `pickupZone` equals the pool's `pickupZone`; destinations
may differ. This explicitly supports the Banani-origin Nusrat and Rafiq
example without adding live routing or detour logic.

The following stay out of scope:

- pool detail reads and passenger manifests;
- `arrive`, `start`, `complete`, and cancellation lifecycle actions;
- driver history;
- frontend UI;
- route optimization, map integration, and advanced matching.

## Data Model and Migration

Add a new migration; do not change prior migrations.

`pools` receives a `pickup_zone` column with the same allowed Dhaka areas as
`ride_requests`. A pool owns this matching key rather than deriving it from a
membership, so compatibility is explicit, immutable, and efficient to query.

Add a partial unique index that permits only one active pool for a driver:

```sql
CREATE UNIQUE INDEX uq_pools_driver_active
    ON pools(driver_id)
    WHERE status IN ('MATCHED', 'DRIVER_ARRIVED', 'STARTED');
```

At this project milestone there is no pool-writing API, so existing deployments
have no pool records to backfill. The migration will still be written as a new
forward-only migration and tested from a clean schema.

A pool is created together with its first `ACTIVE` membership. Therefore an
active pool always has a stored pickup zone and at least one membership.

## Acceptance Transaction

The service runs the following in one PostgreSQL transaction:

1. Lock the driver's `drivers` row with `FOR UPDATE`. This serializes pool
   creation attempts by the same driver.
2. Verify the profile exists, the driver is online, and the driver has an
   active vehicle.
3. Lock the requested ride row with `FOR UPDATE`, then verify it still has
   status `REQUESTED`.
4. Find and lock the driver's `MATCHED` pool with the same pickup zone. If
   none exists, create it with the active vehicle ID, the vehicle's current
   capacity as `capacity_snapshot`, and the ride pickup zone.
5. Sum the pool's `ACTIVE` membership seats. If adding the ride's requested
   seats exceeds `capacity_snapshot`, reject the transaction.
6. Calculate and store the final membership fare using
   `calculateFare(pickupZone, destinationZone, seatsRequested, true)`.
7. Insert an `ACTIVE` pool membership, update the ride to `MATCHED`, and
   insert a durable `REQUESTED` to `MATCHED` ride-status event.
8. Commit. Any failure rolls back every preceding write.

When the driver already has an active pool for a different pickup zone, the
operation returns `409 RIDE_NOT_COMPATIBLE`; it never creates a second pool.
The partial unique index is a database-level defence in depth beyond the
driver row lock.

## API Contract

Successful acceptance returns `201 Created`:

```json
{
  "data": {
    "pool": {
      "id": "uuid",
      "status": "MATCHED",
      "pickupZone": "Banani",
      "capacity": 3,
      "occupiedSeats": 1,
      "availableSeats": 2
    },
    "membership": {
      "id": "uuid",
      "rideRequestId": "uuid",
      "seatsReserved": 1,
      "farePoysha": 7100,
      "status": "ACTIVE"
    }
  }
}
```

The response does not include passenger name, email, or private data.

Errors use the shared error envelope:

| Status | Code | Condition |
| --- | --- | --- |
| 401 | `UNAUTHENTICATED` | No valid session. |
| 403 | `FORBIDDEN` | Authenticated user is not a driver. |
| 404 | `DRIVER_PROFILE_NOT_FOUND` | Driver-role user has no driver profile. |
| 404 | `RIDE_NOT_FOUND` | The requested ride does not exist. |
| 409 | `DRIVER_OFFLINE` | Driver is not online at transaction time. |
| 409 | `NO_ACTIVE_VEHICLE` | Driver has no active vehicle at transaction time. |
| 409 | `RIDE_ALREADY_MATCHED` | Ride is no longer `REQUESTED`. |
| 409 | `RIDE_NOT_COMPATIBLE` | Driver already has a pool for a different pickup zone. |
| 409 | `POOL_FULL` | Reserving the requested seats would exceed capacity. |

## Architecture

Create a `modules/pools` vertical slice following the existing route →
controller → service → repository pattern. The route applies `requireAuth`
and `requireRole("DRIVER")`; the controller reads only `request.user.userId`
and the route parameter.

The repository owns all transactional SQL. It accepts the existing
`withTransaction` runner through dependency injection so unit tests can use a
controlled transaction client. The service owns error mapping and invokes the
pure fare engine. Existing `rides` and `driver` modules remain responsible for
their current APIs; no behavior is moved out of them.

## Verification

Tests cover:

- first acceptance creates a `MATCHED` pool with the active vehicle's capacity
  snapshot and the ride pickup zone;
- a second same-pickup ride reuses the pool and has the expected pooled fare;
- seats, membership, ride status, and status event change together;
- no-session, passenger-role, missing-driver-profile, offline-driver,
  no-vehicle, missing-ride, non-requested-ride, incompatible-ride, and full
  pool errors;
- response privacy; and
- a real PostgreSQL concurrency test where two final-seat claims race, exactly
  one succeeds, and the final active reserved-seat total equals capacity.

The existing database-free `pnpm test` suite remains fast. Add a separate
`pnpm test:db` command for the Docker-backed transaction and concurrency
verification. A dedicated Vitest configuration includes only this intentionally
non-default test file, keeping it out of default discovery. The command must
require `POOL_TEST_DATABASE_URL`, create isolated fixtures, and clean them up
afterwards.

## Documentation

Update the README, project status, API documentation, and database migration
list to describe the new endpoint, compatibility rule, capacity guarantee,
and the `test:db` prerequisite. The next recommended branch is
`feature/pool-lifecycle`; local commits and GitHub pushes are performed only
by the user.
