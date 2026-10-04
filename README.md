# Dhaka Tesla Pool

> Share a seat. Split the fare. Survive Dhaka traffic.

Dhaka Tesla Pool is an internship MVP for deterministic ride pooling around Dhaka zones. Passengers request rides, compatible requests share Jashim's three-seat vehicle Bullet, each passenger receives an individual fare, and PostgreSQL protects seat capacity under concurrent claims.

## Stack

- Node.js and TypeScript
- Next.js App Router
- Tailwind CSS and shadcn/ui
- Express REST API
- PostgreSQL with raw `pg` SQL
- Docker Compose

## Submission Status

The core internship MVP includes authentication, passenger ride requests,
deterministic fares, transactional pooling, driver lifecycle and history,
responsive passenger/driver workspaces, English/Bangla localization, and a
zone-based shared route with per-pickup arrival. Passenger screens show the
current or final stored pool fare from API data.

Before final submission, the remaining release work is deliberately small:

- add the final screenshots and six-minute demo video link;
- update the final status documents and create `pre-release` and
  `release/v1.0.0` from the integrated `master` branch;
- run a clean `docker compose up --build` verification after integrating the
  current feature branch.

The project owner manages GitHub integration and deployment. The current
deployment uses free-tier services; Docker Compose remains the reproducible
local setup.

## Source Documentation

The root-level PRD and engineering blueprint remain the source material for
implementation decisions. Maintained implementation documentation is kept in
the checked-in [`docs/`](docs/README.md) directory.

Maintained implementation documentation begins in [`docs/`](docs/README.md), including the [architecture](docs/ARCHITECTURE.md), [ERD](docs/ERD.md), and [project status](docs/PROJECT_STATUS.md).

## Architecture and Project Structure

```text
Browser
  -> Next.js App Router web app
  -> same-origin /api requests and HttpOnly session cookie
  -> Express REST API
  -> PostgreSQL through parameterized pg queries
```

The repository keeps the frontend, backend, database, and documentation
separate:

```text
apps/web/       Next.js frontend
apps/api/       Express API and domain modules
database/       numbered SQL migrations and deterministic seeds
docs/           architecture, ERD, plans, and decisions
```

The detailed diagrams are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
and [`docs/ERD.md`](docs/ERD.md).

The backend follows one predictable dependency direction:

```text
route -> middleware -> controller -> service -> repository -> PostgreSQL
```

HTTP concerns stay in controllers, business rules stay in services, SQL stays
in repositories, and PostgreSQL remains responsible for durable constraints,
transactions, and row locks.

## Technology Choices

### Next.js and Express REST

- **Chosen:** Next.js App Router for the web application and Express for a
  small REST API.
- **Alternatives:** plain React with a separate router, Fastify, NestJS, or
  GraphQL.
- **Why:** the MVP needs clear browser routes, protected workspaces, and
  resource-oriented HTTP operations without introducing a large abstraction.
- **Switch when:** use a different backend framework or GraphQL when the
  product has materially more complex client data requirements or an
  organization-wide platform standard.

### PostgreSQL with raw `pg` SQL

- **Chosen:** PostgreSQL with `pg`, numbered SQL migrations, explicit
  transactions, and no ORM.
- **Alternatives:** MySQL, SQLite, Prisma, Drizzle, or Knex.
- **Why:** pooling capacity, constraints, and `SELECT ... FOR UPDATE` are
  central to the MVP and remain visible and explainable with explicit SQL.
- **Trade-off:** repositories contain more manual mapping and query code.
- **Switch when:** schema and query volume justify generated types or ORM
  productivity.

### HttpOnly cookie authentication

- **Chosen:** bcrypt password hashing, short-lived JWT sessions, and an
  HttpOnly `auth_token` cookie.
- **Alternatives:** browser token storage, server sessions, OAuth, or a hosted
  identity provider.
- **Why:** the MVP needs a compact role-aware session boundary without exposing
  credentials to browser JavaScript.
- **Switch when:** account recovery, MFA, social login, or organization-wide
  identity management requires a dedicated identity service.

## Current Product Milestone

The repository foundation and PostgreSQL schema are established. This includes
the Node.js workspace, runnable web and API boundaries, Tailwind/shadcn/ui
foundation, Docker services, raw `pg` access, numbered migrations, deterministic
demo seeds, transaction helpers, database health checks, passenger
authentication, passenger ride requests, deterministic fare estimates, driver
availability, capacity-safe pool matching, and pool lifecycle endpoints.
Passengers also have a same-origin web experience for authentication, fare
estimates, ride requests, active-ride status, history, and valid cancellation.
Drivers also have a protected same-origin operations workspace for availability,
waiting requests, an ordered route, per-pickup arrival, trip actions, per-rider
drop-off, and completed-pool history.

## Web Delivery Decisions

### Tailwind CSS + local shadcn/ui-style primitives

- **Chosen:** Tailwind CSS with repository-owned shadcn/ui-style primitives for
  buttons, cards, inputs, labels, badges, alerts, and loading states.
- **Alternatives:** CSS Modules, a component-library runtime such as MUI, or a
  larger design-system package.
- **Why:** It keeps the small MVP visually consistent, responsive, and easy to
  inspect without adding a large client runtime or giving up local ownership of
  component source.
- **Trade-off:** The team owns accessibility and visual refinement of these
  primitives instead of receiving a complete third-party component suite.
- **Switch when:** Move to a formal design system when several products need
  shared tokens, versioned components, or an organization-wide accessibility
  review process.

### Vitest + React Testing Library

- **Chosen:** Vitest with jsdom, React Testing Library, and user-event for the
  Next.js web layer.
- **Alternatives:** Jest with React Testing Library, Playwright-only testing,
  or manual browser verification alone.
- **Why:** It gives fast, focused checks for routes, role redirects, form locks,
  stale estimates, and timer-based polling while keeping tests near the UI
  behavior users can observe.
- **Trade-off:** These tests mock the API boundary and do not replace a real
  browser or deployed-environment test.
- **Switch when:** Add Playwright for cross-browser, visual, and full
  cookie-session journeys once the product has a stable deployed environment.

### Leaflet + OpenStreetMap zone maps

- **Chosen:** Leaflet with OpenStreetMap raster tiles and repository-owned
  approximate centers for the nine supported Dhaka zones.
- **Alternatives:** A hand-drawn SVG map, a commercial mapping SDK, or a static
  image with no interactive markers.
- **Why:** Leaflet gives the passenger and driver views real map context and
  selectable zone markers while keeping the zone identifiers and fare rules in
  the existing application contract.
- **Trade-off:** Tile images depend on an external service; the map is not
  routing, geocoding, or live tracking. The UI must retain its non-map fallback.
- **Attribution:** Maps visibly credit `© OpenStreetMap contributors`. The
  public OpenStreetMap tile service is best-effort, so production traffic may
  require a tile provider with an appropriate service agreement.
- **Configuration:** Set `NEXT_PUBLIC_MAP_TILE_URL` to a compatible tile URL.
  The default is `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, and Docker
  forwards the value as a web build argument. Next.js embeds public environment
  values at build time; changing this value on the deployment host requires
  rebuilding the web image.
- **Switch when:** Use a contracted provider when availability, usage limits,
  or provider-specific styling become production requirements.

### Same-origin API boundary

Browser code calls only relative `/api/...` URLs with `credentials: "include"`.
Next.js rewrites those requests to the server-only `API_INTERNAL_URL`, defaulting
to `http://localhost:4000` for host development and set to `http://api:4000` at
both Docker build and runtime. `API_INTERNAL_URL` is deliberately not a
`NEXT_PUBLIC_*` variable. This keeps the HttpOnly `SameSite=Lax` session cookie
on one browser origin when web and API hosts differ after deployment.

Express retains its restricted `FRONTEND_URL` CORS configuration for deliberate
direct API consumers; the web application itself does not rely on CORS.

### Coordinated driver dashboard hook

- **Chosen:** One coordinated hook, `useDriverDashboard`, with a pure reducer
  for all driver dashboard state transitions.
- **Alternatives:** Separate hooks for availability, requests, and active pools,
  or a client query library such as TanStack Query.
- **Why:** Driver actions affect both the waiting queue and active pool. One
  coordinator can serialize a mutation behind an in-flight refresh, pause every
  poll during that action, then refresh the two related resources together.
  The exported reducer keeps these state changes unit-testable without timers
  or network calls.
- **Trade-off:** The hook owns a small amount of explicit polling and mutation
  coordination instead of receiving caching and invalidation conventions from
  a query library.
- **Switch when:** Introduce TanStack Query when several screens share these
  resources, or when mutation invalidation, retries, pagination, background
  refresh policy, and shared caching become substantial enough to justify it.

## Passenger Authentication

The API exposes the first authentication slice under `/api/auth`:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

Registration and login create an HttpOnly `auth_token` cookie using the
configured JWT secret and expiry. Protected requests send that cookie; logout
clears it. The API also provides reusable role middleware for later driver and
passenger features.



## Fare Engine

Fare calculations use integer poysha and a deterministic MVP distance table:

- Base fare: 5000 poysha
- Distance charge: 1200 poysha per kilometre
- Pool discount: 1500 poysha per seat

The fare is calculated per seat, so the returned total is the fare for one
seat multiplied by the requested seat count. The distance table is a static
MVP estimate rather than live map routing. Ride requests and a new pool's
first membership store the solo fare. When a second or later compatible rider
joins a `MATCHED` pool, that transaction recalculates every active membership
with the pooled discount. Lifecycle actions never change membership fares.
The formal fare lock is `STARTED`; because acceptance and repricing close when
the pool first becomes `DRIVER_ARRIVED`, the stored amount is already stable
when the passenger UI labels it final from that point onward.

The MVP assumes cash settlement after the ride. No real payment gateway or
wallet is implemented because payment processing is outside the internship
scope.

## Product Assumptions

- Supported locations are the named `DHAKA_AREAS` zones, not live GPS points.
- A route is a deterministic estimate from the existing symmetric zone-distance
  table, not turn-by-turn street routing. It visits all distinct pickup zones
  first, then drop-off zones; its first stop is the pool's original pickup.
- Different pickup and destination zones may share a pool only when the best
  all-pickups-first route keeps every rider's detour within
  `POOL_MAX_DETOUR_PERCENT`. The default is 35% so the seeded Nusrat/Rafiq
  Banani example, where Nusrat's detour is 33⅓%, remains compatible; the
  integer setting can be overridden from 0 to 100 in the API environment.
- For example, Banani → Gulshan 1 and Gulshan 1 → Mohakhali can share a pool;
  Banani → Gulshan 1 and Uttara → Dhanmondi are rejected when the first rider's
  detour exceeds the configured limit. Every join reevaluates all active
  riders, not only the newcomer.
- There is no detour surcharge: fares remain based on the solo zone-distance
  estimate and only receive the existing pooled discount.
- One driver has one active vehicle and one active pool at a time.
- Fare values are integer poysha. A first pool member keeps the solo fare;
  when another compatible rider joins a `MATCHED` pool, all active memberships
  are repriced with the pool discount in the same transaction.
- Membership fares lock at `STARTED` and never change during drop-off.
- Passenger cancellation is allowed only from `REQUESTED` and records a status
  event.
- Driver arrival is per pickup zone (riders sharing a zone have one action),
  and the driver cannot start until every active pickup is marked arrived.
  Drop-off is per rider; the pool completes automatically after the last
  active rider is dropped off.
- There is no no-show resolution yet. If a passenger does not appear, their
  pickup can remain unmarked and block trip start; cancellation, reassignment,
  and stuck-pool recovery are deferred.
- The browser never supplies passenger ownership or driver identity for
  protected writes; the API derives identity from the authenticated cookie.

## API Overview

All application endpoints use the `{ "data": ... }` success envelope and the
`{ "error": { "code": ..., "message": ... } }` error envelope.

| Area | Method | Route | Purpose |
| --- | --- | --- | --- |
| Auth | POST | `/api/auth/register` | Register a passenger or driver account |
| Auth | POST | `/api/auth/login` | Create an HttpOnly session cookie |
| Auth | POST | `/api/auth/logout` | Clear the session cookie |
| Auth | GET | `/api/auth/me` | Read the authenticated public user |
| Passenger | POST | `/api/rides/estimate` | Calculate a solo fare estimate |
| Passenger | POST | `/api/rides` | Create a ride request |
| Passenger | GET | `/api/rides/me` | List the passenger's own rides |
| Passenger | GET | `/api/rides/:rideId` | Read one owned ride |
| Passenger | POST | `/api/rides/:rideId/cancel` | Cancel a requested ride |
| Driver | GET | `/api/driver/me` | Read driver status and active vehicle |
| Driver | POST | `/api/driver/status` | Go online or offline |
| Driver | GET | `/api/driver/requests` | List the oldest waiting requests |
| Driver | POST | `/api/driver/requests/:rideId/accept` | Accept a compatible request |
| Driver | GET | `/api/driver/pools/active` | Read the driver's active pool |
| Driver | POST | `/api/driver/pools/:poolId/arrive` | Mark the pool driver-arrived |
| Driver | POST | `/api/driver/pools/:poolId/start` | Start the pool trip |
| Driver | POST | `/api/driver/pools/:poolId/rides/:rideId/drop-off` | Drop off one rider |
| Driver | GET | `/api/driver/history` | Read the driver's completed pools |

The deprecated pool-level completion route remains a no-write compatibility
guard; drivers complete a trip through individual drop-offs.

## Passenger Ride Requests

The ride API provides a public, deterministic estimate plus passenger-owned
ride management:

```text
POST /api/rides/estimate
POST /api/rides
GET  /api/rides/me
GET  /api/rides/:rideId
POST /api/rides/:rideId/cancel
```

`POST /api/rides/estimate` validates the route and returns the solo fare in
poysha. The remaining endpoints require an authenticated passenger cookie.
Creating a ride stores that solo estimate in `estimated_fare_poysha`; a future
pool membership begins at the solo fare and is repriced with the pool discount
when a second compatible rider joins. On this branch a passenger may cancel
only a `REQUESTED` ride, and cancellation records a status event.

## Passenger Web Experience

The web app has public `/login` and `/register` routes and a protected
`/passenger` workspace. Login uses the API's HttpOnly cookie and redirects by
the API-returned role: passengers to `/passenger` and drivers to `/driver`. No
browser token is stored.

The passenger workspace uses API fare estimates, owned ride status/history,
and cancellation while `REQUESTED`. It polls the current non-terminal ride
every five seconds and stops once completed, cancelled, or unmounted. A ride
without a pool shows **Estimated solo fare**; a `MATCHED` pool shows **Current
fare**; `DRIVER_ARRIVED` or later shows **Final fare**, using the stored
membership fare when available. The request form is locked while a ride is
active.

## Driver Availability and Requests

The following endpoints require an authenticated driver cookie:

```text
GET  /api/driver/me
POST /api/driver/status
GET  /api/driver/requests
GET  /api/driver/pools/active
GET  /api/driver/history
POST /api/driver/requests/:rideId/accept
POST /api/driver/pools/:poolId/arrive
POST /api/driver/pools/:poolId/start
POST /api/driver/pools/:poolId/rides/:rideId/drop-off
POST /api/driver/pools/:poolId/complete
```

`POST /api/driver/pools/:poolId/complete` remains only as a compatibility
guard. It returns `409 POOL_COMPLETION_REQUIRES_DROPOFF` and performs no
database write; drivers complete a pool by dropping off each rider instead.

`GET /api/driver/me` supplies the first-load driver snapshot. It, and a
successful `POST /api/driver/status` request with `{ "isOnline": boolean }`,
return the current online state and active vehicle. A driver may go offline at
any time. Going online requires one active vehicle; otherwise the API returns
`409 NO_ACTIVE_VEHICLE` without changing the driver's state.

`GET /api/driver/requests` returns up to 50 `REQUESTED` rides, oldest first.
Its response intentionally excludes passenger IDs, names, and email addresses.

## Driver Active Pool

`GET /api/driver/pools/active` returns the authenticated driver's pool while it
is `MATCHED`, `DRIVER_ARRIVED`, or `STARTED`. The response includes the pool
and assigned vehicle summaries, occupied seats, and active members' ride IDs,
names, routes, reserved seats, and membership fares. It never returns a
passenger email address or passenger ID. An occupied seat is one
reserved by an `ACTIVE` membership whose ride status is not `COMPLETED`; this
same rule protects acceptance capacity and drop-off summaries. A driver with no
active pool receives
`{ "data": null }`; another driver's pool is never returned.

## Driver History

`GET /api/driver/history` returns the authenticated driver's 50 most recently
completed pools, ordered by `completed_at DESC` and then pool ID descending.
The limit applies to pools, so every completed active member of the 50th pool
is included. Each member includes only the passenger name, pickup and
destination zones, reserved seats, final membership fare, and ride completion
time. The pool includes its ID, pickup zone, vehicle summary, start time, and
completion time. Membership fares are the final stored fares locked at
`STARTED`; this read does not recalculate them.

The endpoint is driver-only and always scopes results to the authenticated
driver. It never returns passenger email, passenger user ID, ride ID, or
membership ID. A driver with no completed pools receives
`{ "data": { "pools": [] } }`; a missing driver profile returns
`404 DRIVER_PROFILE_NOT_FOUND`.

## Driver Web Experience

The protected `/driver` workspace uses only same-origin `/api/...` requests and
the existing HttpOnly session cookie. It loads the driver status snapshot once,
then refreshes the waiting requests and active pool every five seconds only
while the browser has a visible tab. It pauses scheduled work for hidden tabs
and all in-flight actions, never overlaps refreshes, and refreshes the queue
and active pool immediately after each action settles.

Drivers may go online only with an active vehicle. The waiting queue hides
passenger identity and disables acceptance while the driver is offline, an
action is pending, or the current pool has already arrived or started. Known
acceptance conflicts have clear local messages; unknown conflicts retain the
server's message.

The active pool card shows each active member's name, pickup to destination,
seats, and current membership fare. It also shows the deterministic ordered
route with a separate arrive action at each pickup zone; shared pickup zones
are grouped. Completed stops remain in place and are marked done, so drop-offs
do not reorder the map route. It never renders a passenger email or passenger ID.
For the seeded shared Bullet scenario, Nusrat is shown as `71.00 Tk` and
Rafiq as `59.00 Tk`. Drivers start after all pickups, then drop off each rider
individually. The pool completes automatically after the final drop-off.

## Driver Pool Acceptance

An online driver accepts a waiting ride with an empty-body request to
`POST /api/driver/requests/:rideId/accept`. The operation is one PostgreSQL
transaction: it locks the driver, then the active pool, then active
memberships/rides, and finally the requested ride; it creates or reuses a
pool, reserves seats, changes the ride to `MATCHED`, and writes a status event.

A compatible ride may use a different pickup or destination zone, but the
server recalculates the best route for every existing non-completed member and
the newcomer. It rejects the complete acceptance with `409 ROUTE_INCOMPATIBLE`
if any rider exceeds the configured detour limit. Route compatibility and
capacity are checked before any membership, ride status, fare, or event writes.
A driver can have only one active pool, and the vehicle capacity snapshot
prevents reservations above its available seats.
The pool membership stores the current integer-poysha fare while the ride
request retains its earlier solo estimate. A first membership is solo-priced;
the successful acceptance of a second or later compatible rider reprices every
active membership to its pooled fare before the transaction commits. The `201`
response includes only the pool summary and membership summary—never passenger
name, email, or ID.

Acceptance can return `409 DRIVER_OFFLINE`, `NO_ACTIVE_VEHICLE`,
`RIDE_ALREADY_MATCHED`, `ROUTE_INCOMPATIBLE`, `POOL_FULL`, or
`POOL_NOT_ACCEPTING`. A pool accepts rides only while its status is `MATCHED`;
an arrived or started pool returns `POOL_NOT_ACCEPTING` without creating a
membership. It returns `404` for an unknown ride or missing driver profile.

`POOL_MAX_DETOUR_PERCENT` is validated as an integer from `0` to `100` and
defaults to `35`. Set it in the root `.env` for local runs; Docker Compose
forwards it to the API service. After changing the value for a running Compose
stack, recreate the API container with `docker compose up -d --build api`.

## Driver Pool Lifecycle

For each pickup stop with unmatched riders, the assigned driver marks arrival
by sending its zone:

```text
POST /api/driver/pools/:poolId/arrive  { "pickupZone": "Banani" }
POST /api/driver/pools/:poolId/start
```

The first arrival changes the pool to `DRIVER_ARRIVED`; later pickup arrivals
remain available while the pool is in that state. Only rides at the selected
pickup move to `DRIVER_ARRIVED`. Start is rejected with
`409 PICKUPS_REMAINING` until all active rides have arrived.

After the pool is started, the driver drops off one passenger at a time with:

```text
POST /api/driver/pools/:poolId/rides/:rideId/drop-off
```

The allowed flow is:

```text
Pool: MATCHED -> DRIVER_ARRIVED -> STARTED -> COMPLETED
Ride: REQUESTED -> MATCHED -> DRIVER_ARRIVED -> STARTED -> COMPLETED
```

An active pool may contain both `MATCHED` and `DRIVER_ARRIVED` rides while the
driver handles distinct pickup zones. After the trip starts, members are
dropped off independently. The displayed route is recalculated from all pool
members, including completed members, and is not persisted; this keeps the
remaining route stable as riders finish.

Each arrival and start is a separate transaction: they lock the assigned
driver, pool, and active member rides. An arrival changes only rides at its
selected pickup and writes one immutable status event per transitioned ride;
start changes every active member ride after all pickups are done. A drop-off
uses the same driver → pool → active memberships/rides lock order, changes only the
selected `STARTED` ride to `COMPLETED`, sets its `completed_at`, and writes one
status event. A started pool may contain both `STARTED` and `COMPLETED` member
rides. Repeated, skipped, and reversed actions return stable 409 errors.
Another driver's pool returns `404 POOL_NOT_FOUND` without revealing its
existence.

Starting records `pools.started_at`; the last drop-off records
`pools.completed_at` and completes the pool in the same transaction.
Membership fares are never changed by drop-off, so they remain locked from
`STARTED` onward. Ride reads expose `completedAt`, which is backfilled for
legacy completed rides by migration 011. The old pool-level complete endpoint
returns `409 POOL_COMPLETION_REQUIRES_DROPOFF` without a repository call.
A completed pool no longer occupies the active-pool constraint, so an online
driver with an active vehicle can accept a later request into a new `MATCHED`
pool.

## Local Setup

Requirements:

- Node.js 24 or a compatible current LTS release
- pnpm 11
- Docker Desktop for Compose verification

Copy the environment template and install dependencies:

```powershell
Copy-Item .env.example .env
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Start both local applications:

```powershell
pnpm dev
```

The web app will use port 3000 and the API will use port 4000. The bootstrap API health endpoint is `GET http://localhost:4000/health`.

The relative web proxy uses `API_INTERNAL_URL=http://localhost:4000` by default
from `.env`. Do not add a public API URL for browser code.

To start PostgreSQL and load the schema plus demo data:

```powershell
docker compose up -d db
pnpm db:setup
```

The database health endpoint is `GET http://localhost:4000/health/db`.

If Compose publishes PostgreSQL on a port other than `5432`, inspect it with
`docker compose port db 5432` and set `DATABASE_URL` to the matching local
connection before running database commands.

## Docker

The Compose topology contains `web`, `api`, and `db` services. PostgreSQL is
available to the API as `db:5432`. The host port is configurable, so inspect
it with `docker compose port db 5432` before choosing a host-side connection:

```powershell
docker compose config
docker compose up --build
```

Compose supplies `API_INTERNAL_URL=http://api:4000` to the web image during its
build and at runtime, so its Next rewrite never bakes a host-only localhost URL
into the container.

After the database service is healthy, run `pnpm db:setup` from the host.

## Verification

The bootstrap checks are:

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
docker compose config
pnpm db:setup
```

The first four commands run in the current workspace. Docker Compose verification requires Docker Desktop to be installed and running.

The real pool capacity-race check is deliberately separate from `pnpm test`.
Use only a local disposable database, set `DATABASE_URL` to it, then set the
same value for `POOL_TEST_DATABASE_URL` in the same PowerShell session:

```powershell
docker compose up -d db
$env:POOL_TEST_DATABASE_URL = $env:DATABASE_URL
pnpm db:setup
pnpm test:db
```

`pnpm test:db` fails closed when `POOL_TEST_DATABASE_URL` is absent, so it
cannot silently connect to the default database. It creates isolated records,
races two claims for the final seat, and cleans up the records afterwards.

Verification on `feature/pool-route-compatibility`:

- API: 30 test files and 283 tests passing;
- web: 23 test files and 129 tests passing;
- typecheck, lint, API and web production builds, `docker compose config
  --quiet`, and `git diff --check` passing.
- PostgreSQL integration: 2 test files and 9 tests passing against an isolated
  temporary local database, removed after verification.
- Full `docker compose up --build` was not run; rerun it as a clean-stack check
  after integrating this branch.

## Known Limitations and Next Improvements

- Route compatibility uses zone-to-zone distance estimates and an all-pickups-
  before-drop-offs ordering. It is not turn-by-turn or traffic-aware routing.
- A passenger no-show can leave an unmatched pickup stop and block trip start.
  No-show cancellation, reassignment, driver override, and recovery are not
  implemented.
- Payment is cash-only for the MVP. There is no payment gateway, wallet,
  notification service, chat, or WebSocket layer.
- Web tests mock the API boundary. Playwright or another browser-level suite
  can be added after a stable deployed environment exists.
- A free-tier deployment has been set up separately by the project owner; this
  branch does not change it. Docker Compose remains the reproducible local
  delivery path.

Recommended next improvements, in order:

1. Complete manual branch integration and rerun the clean Docker Compose check.
2. Add screenshots and the final six-minute demo recording.
3. Add pull-request CI for tests, typecheck, lint, and build.

## AI Usage

AI-assisted tools were used as engineering collaborators for architecture
discussion, edge-case brainstorming, test design, debugging, documentation
review, and UI copy refinement. The submitted code and decisions remain the
author's responsibility and must be explainable in an interview.

### Accepted suggestion

I accepted the recommendation to protect the final seat with a PostgreSQL
transaction and row locks. The driver, active pool, active memberships/rides,
and requested ride are locked in a deterministic order before capacity is
reserved, so two concurrent claims cannot overbook Bullet.

### Rejected or changed suggestion

I did not add Redis, a queue, microservices, or a third-party map provider just
to make the architecture look larger. PostgreSQL transactions and predefined
Dhaka zones solve the MVP's real consistency and geography requirements with
less operational cost. Those choices can change when live location, scale, or
multi-service coordination becomes a documented need.


## The Project in Plain Language

This section explains the main features as a user would experience them. The
technical details and endpoint contracts above remain unchanged.

### A passenger's journey

1. A passenger creates an account or signs in.
2. They choose one of the supported Dhaka pickup zones and a destination zone.
   They can use the map or the zone controls; both select the same zone values.
3. The app asks the API for a fare estimate. The API is the authority for the
   estimate; the browser does not decide the price.
4. When the passenger submits the request, it enters the waiting queue as
   `REQUESTED`.
5. Once a driver accepts it, the passenger can follow the ride status and see
   the current or final pool fare. The page refreshes the active ride
   automatically while it is in progress.
6. A passenger can cancel only before a driver accepts the request. After
   matching, the cancel action is no longer available.

The request form is disabled while that passenger already has an active ride,
which helps avoid duplicate requests. Passengers can review their own rides and
completed-ride history; they cannot read another passenger's ride.

### How the fare changes when rides are shared

The fare uses a base amount plus a distance amount. A compatible shared pool
gets a fixed discount per seat. The API stores money as integer poysha so it
does not depend on decimal rounding.

For the seeded example, Nusrat's Banani → Mohakhali trip is 86.00 Tk alone. If
Rafiq joins the same compatible pool, the API recalculates both active fares:
Nusrat becomes 71.00 Tk and Rafiq becomes 59.00 Tk. If no one joins, the first
passenger keeps the solo fare. The fares stop changing when the trip starts.
The route can add distance, but the MVP does not add a separate detour fee.

### How the driver decides whether rides can share

Before accepting a request, the API checks two things:

- **Seats:** the vehicle must have enough unoccupied seats. A seat remains
  occupied until its ride is completed.
- **Route:** the new ride must fit the shared route without making the trip
  unfairly longer for any existing passenger.

The route checker visits pickup zones before drop-off zones and compares each
passenger's pooled in-vehicle distance with their solo zone distance. The
default maximum extra distance is 35%. Every join is checked against all active
riders. If capacity or route rules fail, the request is rejected before the
pool is changed.

This is a zone-based estimate, not live navigation. Different pickup and
destination zones can share a ride when both the capacity and route checks
pass.

### What the ride statuses mean

The pool is the shared trip. Each passenger also has an individual ride, so a
pool and its rides can be at different stages while the driver handles
separate pickup locations.

| What is happening | Pool status | Passenger ride status |
| --- | --- | --- |
| Waiting for a driver | — | `REQUESTED` |
| A driver has accepted | `MATCHED` | `MATCHED` |
| The driver is handling pickups | `DRIVER_ARRIVED` | `MATCHED` or `DRIVER_ARRIVED` |
| The trip has started | `STARTED` | `STARTED` |
| One passenger has been dropped off | `STARTED` while others remain | That passenger: `COMPLETED` |
| The last passenger has been dropped off | `COMPLETED` | All rides: `COMPLETED` |

The driver marks arrival separately for each pickup zone. Passengers at the
same pickup share one arrival action. The driver cannot start until every
active pickup is marked as reached. After the start, each passenger is dropped
off separately; the pool completes automatically after the final drop-off.
This lets one passenger finish without incorrectly completing everyone else's
ride.

### What the driver sees

The driver can switch availability, review waiting requests, accept a ride,
manage pickup arrivals, start the trip, and drop off each passenger. The
waiting queue does not reveal passenger names or contact details. In the
active pool, the driver sees the names and trip information needed to provide
the ride, but not passenger email addresses or account IDs.

The dashboard refreshes the queue and active pool while it is visible. It
pauses automatic refreshes when the browser tab is hidden or an action is in
progress, and refreshes again after the action finishes. This keeps information
current without sending overlapping requests.

### Accounts, privacy, maps, and payment scope

- **Sign-in:** passwords are hashed, and the authenticated session is carried
  in an HttpOnly cookie. The browser does not keep the session token in
  JavaScript storage. Protected API routes determine the account from that
  session.
- **Privacy:** passenger ride reads are limited to the signed-in passenger.
  Driver reads are limited to the signed-in driver's pool and history.
- **Maps and language:** the map displays supported zones and helps choose
  them; it does not provide GPS tracking or turn-by-turn directions. The web
  interface includes English and Bangla localization. If map tiles fail, the
  zone controls remain available.
- **Payments:** the project does not move money or connect to a payment
  gateway or wallet. Any payment choice or confirmation shown in the interface
  is for demonstration only; it is not proof of a real transaction.

### Why database transactions matter

When two requests compete for the same remaining seat, checking capacity in
the browser would not be safe: both could see the seat as available at once.
Instead, the API checks and reserves seats inside a PostgreSQL transaction with
database locks. The same approach keeps pool membership, ride statuses, fares,
and status events consistent if an action fails partway through.
