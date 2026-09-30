# Driver History Design

## Purpose

Add a privacy-safe history read for the authenticated driver. The driver must
be able to review completed Bullet pools, the passengers served in each pool,
the routes, the seats, the final membership fares, and the completion times.
This feature is read-only: it does not change pool, ride, membership, or event
state.

## Scope

Add one driver-only endpoint:

```text
GET /api/driver/history
```

The endpoint returns the driver's 50 most recently completed pools. Pools are
ordered newest first by `pools.completed_at DESC`, with `pools.id DESC` as the
deterministic tie-breaker. Each completed pool includes all of its completed,
active memberships ordered by join time. An empty result is a successful
response with an empty `pools` array, not a 404.

No migration is required. The existing `pools.completed_at`,
`ride_requests.completed_at`, `pool_memberships.fare_poysha`, and driver/pool
indexes provide the required data. A bounded MVP result avoids pagination and
does not poll history in the background.

## API Contract

Success:

```json
{
  "data": {
    "pools": [
      {
        "id": "pool-id",
        "pickupZone": "Banani",
        "vehicle": { "name": "Bullet", "capacity": 3 },
        "startedAt": "2026-09-29T14:00:00.000Z",
        "completedAt": "2026-09-29T14:30:00.000Z",
        "members": [
          {
            "passengerName": "Nusrat",
            "pickupZone": "Banani",
            "destinationZone": "Mohakhali",
            "seatsReserved": 1,
            "farePoysha": 7100,
            "completedAt": "2026-09-29T14:30:00.000Z"
          }
        ]
      }
    ]
  }
}
```

The response contains passenger names only. It must never include passenger
email, passenger user ID, password data, or internal ride/membership IDs.
The query is scoped by the authenticated driver's `drivers.id`; another
driver's completed pools must never appear.

Only pools with `status = 'COMPLETED'` and a non-null `completed_at` are
returned. Members must have `pool_memberships.status = 'ACTIVE'` and linked
rides with `status = 'COMPLETED'` and non-null `completed_at`. The stored
membership fare is the final fare and is returned unchanged.

Unauthenticated requests receive `401 UNAUTHENTICATED`, passenger sessions
receive `403 FORBIDDEN`, and a driver-role user without a driver profile
receives `404 DRIVER_PROFILE_NOT_FOUND`.

## Backend Architecture

Keep history in the existing pools vertical slice:

```text
route -> controller -> service -> repository -> PostgreSQL
```

The repository adds `listDriverHistory(driverUserId: string)` and returns a
typed `driver_profile_missing` outcome when the authenticated user has no
driver profile. The SQL first selects the driver's completed pools in a CTE
with `LIMIT 50`, then joins vehicles, active memberships, completed rides, and
the passenger name. This keeps the limit at the pool level rather than
accidentally limiting member rows. The controller serializes only the fields
listed in the public contract.

## Driver UI

Extend `useDriverDashboard` with a `history` collection and a coordinated
`refreshHistory` action. Load history once when the dashboard mounts and
refresh it after any driver action settles. Do not add a second five-second
history poll; the existing five-second poll remains limited to waiting rides
and the active pool.

Add a presentational `DriverHistory` component below the operational dashboard.
It shows an empty state when there are no completed pools and, for each pool,
the completion date, pickup zone, vehicle, and each passenger's name, route,
seats, final fare, and completion time. It must not render any email or ID.

## Verification

Backend tests must cover:

- exact history ordering and the 50-pool limit;
- empty history;
- only the authenticated driver's completed pools;
- active completed members, final fares, and timestamps;
- exclusion of in-progress pools and incomplete/cancelled members;
- no passenger email, passenger user ID, ride ID, or membership ID in the
  response; and
- 401, 403, and missing-driver-profile behavior.

Frontend tests must cover the exact API path, initial history loading,
post-action refresh, empty state, completed pool/member rendering, and privacy
of the rendered output.

## Manual Commit Checkpoints

The user performs all Git operations manually. Stop after each checkpoint:

1. Backend API, repository/service/controller tests, and documentation:

   ```text
   feat(driver): expose completed pool history
   ```

2. Driver API client, hook, history card, and UI tests:

   ```text
   feat(driver): show completed pool history
   ```
