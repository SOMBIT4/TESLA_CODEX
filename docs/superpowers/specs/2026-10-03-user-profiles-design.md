# User Profiles Design

**Status:** Approved  
**Date:** 2026-10-03  
**Planned branch:** `feature/user-profiles` (created and managed by the project owner)

## Purpose

Add role-specific profile sections so passengers and drivers can view and edit
their own personal details. Drivers can also edit their vehicle name and seat
capacity when doing so cannot interfere with ride matching. The feature must
preserve existing authentication, ride, fare, pool, and dashboard behavior.

## Scope and non-goals

In scope:

- Passenger profile page at `/passenger/profile`.
- Driver profile page at `/driver/profile`.
- Editable name and optional phone number for both roles.
- Read-only email address for both roles; any valid email provider remains
  accepted. This feature does not add Gmail-only validation or email changes.
- Driver vehicle name and capacity editing under the availability rules below.
- A new additive PostgreSQL migration, authenticated API updates, localized
  profile UI, and automated tests.

Out of scope:

- Refresh/access-token changes, password changes, email changes, profile
  photos, addresses, SMS/phone verification, or additional vehicle fields.
- Payment method selection or payment processing.
- Changes to ride, pool, fare, matching, or status-event behavior.

## Existing behavior to preserve

- `GET /api/auth/me` returns the authenticated user's public account details.
- `GET /api/driver/me` returns the authenticated driver's online state and
  active vehicle snapshot.
- The auth token remains in the existing HttpOnly cookie. Login, registration,
  logout, and session expiry are unchanged.
- Current database migrations are immutable. Add a new migration after
  `011_add_ride_completion_timestamp.sql`.
- Existing dashboard endpoints and response fields remain compatible. Phone
  numbers are private profile data and must not be added to ride, pool, driver
  request, or history responses.

## Data model

Add `phone_number VARCHAR(20) NULL` to `users` in a new migration named
`012_add_user_phone_number.sql`. Existing users remain valid and receive
`NULL`; phone number is optional and is not unique. Do not modify migration 001
or any other applied migration.

Store phone numbers in normalized international form. After trimming and
removing spaces or hyphens, accept either a local number matching
`^01[3-9][0-9]{8}$` or an international number matching
`^\+8801[3-9][0-9]{8}$`; normalize valid input to the `+8801...` form and
reject malformed values with the existing validation-error envelope. No
verification is performed, so the UI must not label a saved number as
verified.

Vehicle name and capacity continue to use the existing `vehicles` fields.
Capacity must remain within the current application limit of 1–4 seats.

## API contract

### Current user's profile

Keep `GET /api/auth/me`, extending the returned user with `phoneNumber`, which
is either a normalized string or `null`:

```json
{
  "data": {
    "user": {
      "id": "user-id",
      "name": "Nusrat",
      "email": "nusrat@example.com",
      "role": "PASSENGER",
      "phoneNumber": "+8801XXXXXXXXX",
      "createdAt": "2026-10-03T08:00:00.000Z"
    }
  }
}
```

Add `PATCH /api/auth/me`, protected by the existing `requireAuth` middleware.
It accepts a partial update containing `name`, `phoneNumber`, or both. At least
one supported field must be supplied. `phoneNumber: null` clears the optional
number. The authenticated user ID from the verified cookie is the only row
scope; clients cannot provide a target user ID, role, email, or password.
Reject unsupported or immutable fields instead of applying them. Return the
same public user shape as `GET /api/auth/me` after the update.

### Driver vehicle profile

Keep `GET /api/driver/me` and its current response shape unchanged. Add a
driver-only endpoint:

```text
PATCH /api/driver/me/vehicle
```

The request accepts the vehicle `name` and `capacity`, validates capacity from
1 through 4, and scopes the update to the authenticated driver's active vehicle.
The response returns the updated vehicle within the existing driver snapshot
shape. Passenger sessions receive `403 FORBIDDEN`; no session receives
`401 UNAUTHENTICATED`; a missing driver profile continues to receive
`404 DRIVER_PROFILE_NOT_FOUND`. A driver without an active vehicle receives
`404 ACTIVE_VEHICLE_NOT_FOUND`; no vehicle data is changed.

If the driver is online or has an active pool (`MATCHED`, `DRIVER_ARRIVED`, or
`STARTED`), reject the update with `409 VEHICLE_PROFILE_LOCKED` and perform no
writes. Check this on the server, not only by disabling the form. Serialize the
update with availability and lifecycle operations using the established
driver-first lock order, so an online toggle or ride acceptance cannot race a
capacity edit. A completed pool does not block later vehicle edits.

## Frontend behavior

Add role-protected profile routes at `/passenger/profile` and `/driver/profile`,
and make each reachable through the authenticated application navigation.
Follow the existing dashboard visual language, form controls, loading/error
states, and English/Bangla localization patterns.

Both pages show name, email, and optional phone number. Name and phone can be
edited and saved; email is displayed as non-editable. Clearing the phone number
persists `null`. The UI may show a success confirmation after saving, but must
not imply phone verification.

The driver page also shows the current online state and vehicle name/capacity.
Vehicle fields are editable only when the driver is offline and has no active
pool. If the API responds with `VEHICLE_PROFILE_LOCKED` (including after a
stale page or concurrent action), show a clear message and refresh the driver
snapshot. Editing a vehicle never toggles online status or changes a ride/pool.

The profile pages must not display other users' profile data. Existing
passenger/driver dashboards continue to operate without requiring a profile
visit or a non-null phone number.

## Failure behavior and privacy

- No-session profile requests return `401`; role-incompatible driver vehicle
  updates return `403`.
- Updates are authorized and scoped using the session identity, never a client
  supplied user or driver ID.
- Validation failures do not write partial profile changes.
- A profile-read or save error is shown locally and does not log the user out
  unless the API identifies the session as unauthenticated.
- Phone number is returned only by the authenticated self-profile endpoint; it
  is excluded from ride and pool data returned to other users.
- Keep current cookie flags and JWT behavior unchanged.

## Tests

Backend tests cover:

- `GET /api/auth/me` returns `phoneNumber: null` for existing users without a
  phone number and returns a saved normalized number when present.
- `PATCH /api/auth/me` updates only the session owner's name and/or phone;
  clearing phone stores `NULL`; invalid phone or empty update is rejected
  without writes.
- Email, role, password, and another user's profile cannot be changed through
  this endpoint; unauthenticated requests return `401`.
- Driver vehicle update accepts valid name/capacity and rejects capacities
  outside 1–4, unauthenticated requests with `401`, and passenger requests with
  `403`.
- Online drivers and drivers with a `MATCHED`, `DRIVER_ARRIVED`, or `STARTED`
  pool receive `409 VEHICLE_PROFILE_LOCKED` with no writes; offline drivers
  without an active pool can update the vehicle.
- Driver profile absence retains `404 DRIVER_PROFILE_NOT_FOUND`; a missing
  active vehicle returns `404 ACTIVE_VEHICLE_NOT_FOUND`; vehicle and phone
  details do not leak into ride, pool, request, or history responses.
- Migration succeeds on an existing database and on a fresh database without
  editing prior migration files.

Frontend tests cover:

- Each role sees only its own profile page and the appropriate fields.
- Name/phone load and save, nullable phone clearing, validation feedback,
  saving/error states, and the non-editable email field.
- Driver vehicle fields are disabled while online or in an active pool, and a
  server-side `409` produces a friendly message and refreshed snapshot.
- English and Bangla labels are present; existing authentication and dashboard
  test suites remain green.

## Deployment and Git boundary

The additive migration must be applied to Neon before relying on the new API
field. Deploy the API and web changes through their existing Render and Vercel
projects after the feature is merged. No new hosting secret or provider is
required. Existing Render sleep behavior and Neon connection configuration are
unchanged.

The project owner creates `feature/user-profiles`, performs all commits,
pushes, and merges manually. The assistant must not perform Git operations.
After implementation and verification, stop for the owner's manual commit and
provide a suggested commit message.

## Acceptance criteria

- Passenger and driver can view and edit their own name and optional phone.
- Phone input accepts the specified Bangladesh formats, stores normalized
  values, and is never represented as verified.
- Email remains read-only and valid non-Gmail addresses continue to be allowed.
- Driver can edit vehicle name/capacity only while offline and without an
  active pool; all enforcement is server-side and race-safe.
- Existing ride, pool, fare, auth-session, and dashboard behavior remains
  compatible, and phone data is not exposed to other users.
- New and existing database migration, API, and web tests pass.
