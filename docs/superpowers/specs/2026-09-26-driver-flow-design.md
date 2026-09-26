# Driver Flow Design

## Purpose

Add the first driver-facing API surface for the Dhaka Tesla Pool MVP. An
authenticated driver can inspect their availability and active vehicle, change
availability, and see a safe, bounded list of waiting ride requests. This is
an operational dashboard only; it must not create pools, assign rides, change
ride status, or expose passenger identity.

## Scope

This design implements three driver-only endpoints:

```text
GET  /api/driver/me
POST /api/driver/status
GET  /api/driver/requests
```

`GET /api/driver/history` is deferred to `feature/ride-history`. Pool
acceptance, matching, capacity allocation, pooled fares, and lifecycle actions
are deferred to their dedicated feature branches.

## API Contract

### Driver snapshot

`GET /api/driver/me` returns the first-load driver snapshot. `POST
/api/driver/status` accepts a JSON body with one boolean field, `isOnline`,
and returns the same snapshot after the update.

```json
{
  "data": {
    "isOnline": true,
    "vehicle": {
      "id": "uuid",
      "name": "Bullet",
      "capacity": 3,
      "isActive": true
    }
  }
}
```

When the driver has no active vehicle, `vehicle` is `null`. Going offline is
always allowed. Going online without an active vehicle returns `409` with
`NO_ACTIVE_VEHICLE` and does not change `drivers.is_online`.

### Waiting requests

`GET /api/driver/requests` returns at most 50 `REQUESTED` ride requests,
sorted oldest first by `created_at` and then `id` for deterministic ties.
With one driver in the MVP, every requested ride is relevant; matching and
assignment are intentionally not part of this branch.

Each request exposes only:

```json
{
  "id": "uuid",
  "pickupZone": "Banani",
  "destinationZone": "Mohakhali",
  "seatsRequested": 1,
  "estimatedFarePoysha": 8600,
  "createdAt": "2026-09-26T00:00:00.000Z"
}
```

Passenger IDs, names, emails, password data, and cancellation timestamps are
not included.

## Authorization and Errors

All driver endpoints use the existing `requireAuth` and `requireRole("DRIVER")`
middleware. A request without a valid session returns `401 UNAUTHENTICATED`; a
passenger session returns `403 FORBIDDEN`.

After role authorization, a driver-role user without a `drivers` record
returns `404 DRIVER_PROFILE_NOT_FOUND`. Validation rejects a missing or
non-boolean `isOnline` value with `400 VALIDATION_ERROR`.

## Architecture and Data Access

A new `modules/driver` vertical slice follows the existing route → controller
→ service → repository structure. A new migration adds
`drivers.updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` and the partial unique
index `ON vehicles(driver_id) WHERE is_active`, so one driver cannot have more
than one active vehicle.

The repository uses parameterized SQL to find a driver by authenticated
`user_id`, select the active vehicle, and retrieve the privacy-safe requested
ride projection. Going online uses one conditional update that sets
`is_online` and `updated_at` only when an active vehicle still exists:

```sql
UPDATE drivers
SET is_online = $2::boolean,
    updated_at = NOW()
WHERE user_id = $1
  AND ($2::boolean = FALSE OR EXISTS (
    SELECT 1
    FROM vehicles
    WHERE driver_id = drivers.id
      AND is_active = TRUE
  ))
RETURNING id, is_online, updated_at;
```

The service first resolves the driver profile so an absent profile remains a
`404 DRIVER_PROFILE_NOT_FOUND`. For an existing profile, no row from the
conditional update means the active vehicle disappeared or is absent; it
returns `409 NO_ACTIVE_VEHICLE`. No transaction is required because the
single-row conditional update prevents an invalid online transition.

## Verification

Tests must cover:

- snapshot loading and status changes for a driver with Bullet;
- online rejection without an active vehicle and successful offline update;
- `401` for all three driver routes without a session;
- `403` for passenger sessions on all three driver routes;
- `404 DRIVER_PROFILE_NOT_FOUND` for a driver-role user without a profile;
- only `REQUESTED` rides, oldest-first ordering, and the 50-result limit;
- absence of passenger ID, name, and email from every waiting-ride response;
- a rejected online transition leaves `drivers.is_online` as `false`.
