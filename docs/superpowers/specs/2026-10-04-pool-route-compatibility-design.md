# Pool Route Compatibility and Per-Pickup Arrival Design

**Status:** Implemented; verification in progress
**Branch:** feature/pool-route-compatibility

## Purpose and scope

Allow a driver's active pool to combine rides with different pickup zones or
destinations only when a deterministic zone-based route keeps every passenger's
detour within a configured limit. Track arrival separately for each pickup
zone, while retaining one action for passengers who share a pickup.

This is an additive feature. It does not change the existing fare formula,
database schema, authentication, seat rules, payment behavior, or unrelated
endpoints. No map provider, GPS enforcement, traffic estimates, or persistent
route-plan table is added. The route is derived from the project's existing
symmetric Dhaka zone-distance table; it is a deterministic estimate, not
street routing.

## Current behavior to replace

Pool acceptance currently requires a new ride's pickup zone to equal the
pool's original pickup zone. The driver arrival action currently changes the
pool and every active ride together. Passenger fare labels are currently
selected using ride status rather than the pool status.

The existing states remain:

- Pool: MATCHED → DRIVER_ARRIVED → STARTED → COMPLETED.
- Ride: REQUESTED → MATCHED → DRIVER_ARRIVED → STARTED → COMPLETED, with
  REQUESTED → CANCELLED.

An active pool can contain rides in both MATCHED and DRIVER_ARRIVED while
pickup stops are being handled. After start, individual rides can be STARTED
or COMPLETED until the last drop-off completes the pool.

## Zone distances and selected detour limit

Each unordered pair in DHAKA_AREAS is declared once and mirrored for
symmetric lookup. The route module defines the distance from a zone to itself
as zero. Fare estimation keeps its existing behavior and still rejects a
same-zone ride request.

The relevant table distances are:

| Leg | Distance |
| --- | ---: |
| Banani ↔ Gulshan 1 | 2 km |
| Banani ↔ Mohakhali | 3 km |
| Gulshan 1 ↔ Mohakhali | 2 km |
| Uttara ↔ Gulshan 1 | 12 km |
| Uttara ↔ Dhanmondi | 12 km |
| Gulshan 1 ↔ Dhanmondi | 6 km |

For the seeded same-pickup example, Nusrat travels Banani → Mohakhali (solo
distance 3 km), and Rafiq travels Banani → Gulshan 1 (solo distance 2 km).
The best all-pickups-first order drops Rafiq at Gulshan 1, then Nusrat at
Mohakhali:

- Nusrat travels 2 + 2 = 4 km in the pool: 1 km extra, or 33⅓% over solo.
- Rafiq travels 2 km: no extra distance over solo.

The 35% default is chosen so this Nusrat/Rafiq example is compatible. At
30%, Nusrat fails the integer check (1 × 100 > 3 × 30); at 35%, she passes
(1 × 100 ≤ 3 × 35). The distance table is unchanged.

Different pickup zones are allowed when the complete route fits the limit.
For a compatible example, Rafiq travels Banani → Gulshan 1, while another
passenger boards at Gulshan 1 and travels to Mohakhali. The ordered phases are
Banani pickup, Gulshan 1 pickup, then Gulshan 1 and Mohakhali drop-offs. The
Gulshan 1 phase transition has zero distance: Rafiq's in-vehicle trip is
2 km against 2 km solo, and the second passenger's is 2 km against 2 km solo.

A different-pickup example that must be rejected is an existing Banani →
Gulshan 1 rider plus a newcomer Uttara → Dhanmondi. All pickups happen before
drop-offs, so after the Banani pickup the route must travel to Uttara before
either passenger can be dropped off. Even with Gulshan 1 as the first
drop-off, the Banani rider travels 12 + 12 = 24 km against 2 km solo, far above
35%. A route order cannot make this pair compatible.

## Route calculation

On every acceptance attempt, calculate a best route for all active,
non-completed member rides plus the requested ride. Do not evaluate only the
new rider against the pool anchor.

1. Visit every distinct pickup zone before any drop-off phase. Group riders
   sharing the same phase and zone into one stop. A zone may occur once in
   each phase when one rider boards there and another leaves there.
2. Start at the pool's original pickup zone, the first accepted ride's pickup.
   Keep that pickup first. Enumerate the remaining distinct pickup-stop
   permutations and distinct drop-off-stop permutations. Vehicle capacity is
   capped at four seats, so at most four one-seat rides can be in a pool and
   at most 3! × 4! = 144 stop orders are considered.
3. For each candidate order, calculate each rider's in-vehicle distance by
   summing the route legs from their pickup stop through their own drop-off
   stop. Their solo distance is the direct configured distance between their
   pickup and destination.
4. Extra distance is max(0, in-vehicle distance − solo distance). Apply the
   configured limit using integer comparison only:

       detourKm × 100 <= soloDistanceKm × POOL_MAX_DETOUR_PERCENT

5. Select the route that minimizes the largest per-passenger detour ratio.
   Compare ratios by cross multiplication. Break ties by lower total route
   distance, then lexicographically by pickup and drop-off stop order using
   the declared DHAKA_AREAS order. Input/database row order and ride IDs must
   not affect the selected order.
6. Accept only if every member and the newcomer pass the configured limit.
   Otherwise return HTTP 409 ROUTE_INCOMPATIBLE before changing membership,
   ride status, fare, or status events.

The route is a practical MVP approximation: different pickup zones and
destinations may share a pool, but proximity alone does not make a route
compatible.

## Configuration

POOL_MAX_DETOUR_PERCENT is an integer from 0 through 100 and defaults to 35.
An invalid value must fail API startup instead of silently changing matching
decisions. Add the variable to the API environment parser, .env.example, and
the Docker Compose API environment so the same setting works locally and in
containers.

## Acceptance, capacity, locking, and fares

Keep the existing transaction lock order: driver row, active pool,
active-membership and ride rows, then the requested ride. Under those locks,
check that the pool still accepts requests, compute route compatibility, and
check capacity before making any writes. A rejection must not create a pool
membership or event and must not reprice any existing fare.

Only a MATCHED pool accepts a new ride. Once the first pickup is marked and
the pool becomes DRIVER_ARRIVED, later pickup actions can continue but no new
ride can join. This closes fare repricing at first arrival.

Fares remain based on each rider's direct solo zone distance and the existing
solo/pooled membership rules. There is no detour surcharge; route choice never
changes fare values. Acceptance can reprice active memberships only while the
pool is MATCHED. The formal fare lock remains at STARTED. Since the pool
cannot accept or reprice after the first arrival, the stored fare is already
stable when the passenger-facing label changes to Final fare at
DRIVER_ARRIVED.

An incompatible acceptance returns HTTP 409 with code ROUTE_INCOMPATIBLE. The
driver UI shows a friendly message such as “This request adds too much detour
to the current route.” Other existing conflict codes retain their meanings.

## Per-pickup arrival lifecycle

Arrival is one action per distinct pickup zone:

- If all current riders share a pickup, the dashboard shows one action for
  that zone and marks all its MATCHED rides arrived.
- If pickup zones differ, the dashboard shows a separate action for each
  pickup zone that still has MATCHED rides, listing each passenger and their
  reserved seats.
- A stop's action is available only while at least one ride at that stop is
  MATCHED. Marking it changes only those rides; other pickup groups remain
  MATCHED.

The driver-only endpoint remains POST /api/driver/pools/:poolId/arrive, and
its required JSON body is { "pickupZone": "<Dhaka area>" }. Missing, malformed,
or unsupported pickupZone values return HTTP 400 VALIDATION_ERROR. A valid
zone with no MATCHED rider at that pool returns HTTP 409
PICKUP_STOP_NOT_AVAILABLE without writes. Repeating a completed stop is not
idempotent and must not write duplicate events.

The first successful pickup action changes the pool from MATCHED to
DRIVER_ARRIVED. Later successful pickup actions are allowed while the pool is
DRIVER_ARRIVED, but only for a stop that still has MATCHED rides. The state
mismatch guard therefore allows a DRIVER_ARRIVED pool to contain rides in
MATCHED or DRIVER_ARRIVED. Occupied seats remain active memberships whose
rides are not COMPLETED.

The driver can start only after every non-completed active member ride is
DRIVER_ARRIVED. An early start returns HTTP 409 PICKUPS_REMAINING and writes
nothing. Start then changes the pool and all arrived member rides to STARTED
atomically. Existing per-rider drop-off remains unchanged.

## Stable derived route and active-pool response

The displayed route is recomputed from every ACTIVE membership in the pool,
including rides already COMPLETED. Ride status must not be an input to route
ordering, so dropping off one passenger cannot reorder the remaining route.
No route is persisted.

The driver active-pool response keeps its current privacy boundary and adds
member ride status plus ordered route stops. Current non-completed members
continue to drive the occupied-seat count and member list. Route stops retain
all pool members, including completed members, and group each phase/zone with
passenger name and seats. Each stop includes a derived done flag:

- A pickup stop is done when all its rides have advanced beyond MATCHED.
- A drop-off stop is done when all its rides are COMPLETED.

The API never exposes passenger email, phone number, or passenger user ID.
Route stop ordering is derived from the same route calculator as acceptance;
done flags are derived from ride status. Neither is persisted.

The driver dashboard and pool map render these ordered stops, rather than
reconstructing a route from only the original pickup and active destinations.
Markers distinguish pickup from drop-off phases, group members at a shared
phase/zone, and show completed stops as done.

## Passenger fare labels and API data

Passenger ride reads already return the membership fare, but must also return
the owning pool's status for a member ride. Add a nullable poolStatus field to
the passenger ride record and API response by joining through the active
membership to its pool; no migration is required. For a ride with no pool,
poolStatus is null.

Both the current ride card and passenger history choose the label from
poolStatus, not from the individual ride status:

- No membership/pool: Estimated solo fare.
- Pool MATCHED: Current fare.
- Pool DRIVER_ARRIVED, STARTED, or COMPLETED: Final fare.

This applies even when the passenger's individual ride remains MATCHED because
their pickup stop has not yet been marked. The displayed fare is the stored
membership fare when present; the solo estimate remains the fallback when no
membership exists. No other passenger's data is added to these reads.

## No-show and stuck-pool limitation

Document, but do not fix, the no-show case in this branch: if a passenger does
not appear at their pickup, the driver may leave that stop unmarked. The pool
then remains DRIVER_ARRIVED with at least one ride MATCHED, and start remains
blocked by PICKUPS_REMAINING. There is no no-show cancellation, reassignment,
timeout, or recovery flow in this branch. Do not add a workaround or alter
the lifecycle to hide this limitation.

## Tests and acceptance criteria

### Route and acceptance

- Nusrat and Rafiq's Banani example pools at the 35% default; assert selected
  order, solo distance, in-vehicle distance, and detour for each rider.
- The different-pickup Banani → Gulshan 1 and Gulshan 1 → Mohakhali pair pools
  with both riders at or below the limit.
- The different-pickup Banani → Gulshan 1 and Uttara → Dhanmondi pair is
  rejected; assert the existing rider's detour causes the rejection.
- Opposite-direction routes are rejected when no valid all-pickups-first
  ordering fits.
- A newcomer that pushes an existing member over the limit is rejected with
  no membership, ride status, fare, or event writes.
- Exact-threshold route passes; a route one percentage point beyond the
  configured integer limit fails.
- A deterministic tie is stable across repeated evaluations and input order.
- Route distance from a zone to itself is zero, including a pure route case
  with pickup and drop-off at the same zone.
- Environment default, accepted override, and invalid configuration are
  tested. Capacity and concurrent final-seat acceptance tests remain green.

### Pickup lifecycle and stable route

- A same-pickup pool has one pickup stop/action.
- With different pickup zones, arriving at one stop transitions only its
  MATCHED rides; the pool becomes DRIVER_ARRIVED and other rides remain
  MATCHED. A later action at another eligible stop succeeds.
- Arrive on MATCHED and DRIVER_ARRIVED pools is supported only when the chosen
  stop still has MATCHED rides.
- Missing/invalid pickupZone returns 400 VALIDATION_ERROR. An unavailable
  stop, duplicate arrival, wrong driver, and other-driver pool create no
  partial writes.
- Start with any MATCHED rider returns PICKUPS_REMAINING with no writes; start
  succeeds once all active non-completed members have arrived.
- Active route order is identical before and after a member is completed;
  completed pickup/drop-off stops are marked done.
- The same-zone route distance test passes. Occupied seats count every active
  membership except COMPLETED rides.

### Passenger and driver UI

- Driver route stops list names and seats, group shared destinations and
  pickups correctly, show completed stops as done, and submit pickupZone.
- ROUTE_INCOMPATIBLE maps to friendly copy; unknown errors preserve the
  server's message.
- Passenger active ride and history use Current fare for pool MATCHED and
  Final fare for DRIVER_ARRIVED or later, including a ride that itself remains
  MATCHED.
- Passenger data remains owner-scoped and contains no other passenger data.
- Existing drop-off, fare-lock, capacity, privacy, and concurrency suites stay
  green.
