# Passenger Frontend Design

## Purpose

Build the first usable browser experience for the internship MVP. A passenger
can register, sign in, request a deterministic ride, see the solo fare estimate
returned by the API, monitor their current ride, review their own ride list,
and cancel a request while it remains cancellable.

This is deliberately a frontend-only branch. It consumes the existing Express
API and does not invent pool-membership fare, pool-detail, or event-history
data that the API does not expose.

## Scope and Success Criteria

- Public routes provide passenger registration and login.
- Authenticated passengers use a responsive `/passenger` dashboard with an
  estimate-and-request form, current-ride status, and history.
- The active ride is refreshed every five seconds without WebSockets. Polling
  ends on `COMPLETED` or `CANCELLED`, and cleanup prevents polling after the
  component unmounts.
- Login uses the server's HttpOnly cookie through `fetch(...,
  { credentials: "include" })`; JavaScript never reads or stores a token.
- Browser code calls only relative `/api/...` URLs. Next.js rewrites those
  requests to a private, server-side `API_INTERNAL_URL`, so deployment does
  not depend on cross-origin browser cookies or public API hostnames.
- Login redirects a `PASSENGER` to `/passenger` and a `DRIVER` to `/driver`.
  `/driver` is an explicit placeholder until the driver UI branch exists.
- The product uses its own text identity, `Dhaka Tesla Pool` and `Bullet`.
  It must not use Tesla's logo, logo-like glyphs, or imitate Tesla's wordmark.
- Loading, validation, empty, unauthenticated, forbidden-role, and API-error
  states are understandable and keyboard-accessible.
- The README explains why this MVP uses Tailwind and shadcn/ui, alternatives
  considered, the trade-off, and when the choice would change.

## Out of Scope

- New Express routes, migrations, or database changes.
- Final pooled fare, pool-membership details, passenger event history, maps,
  GPS, WebSockets, payments, notifications, or driver workflow UI.
- A marketing site, Tesla branding assets, or an unverified hard-coded ride.

## Same-Origin API Proxy and Existing API Contract

The browser API client has the fixed base path `/api` and always includes
credentials. `next.config.ts` rewrites `/api/:path*` to
`${API_INTERNAL_URL}/api/:path*`; `API_INTERNAL_URL` must never have the
`NEXT_PUBLIC_` prefix. This makes the browser see the web app as the cookie
origin, while Next.js forwards the request and cookie to Express.

For host development, `.env.example` documents
`API_INTERNAL_URL=http://localhost:4000`. Docker Compose overrides this value
for the web image's build and runtime environments with `http://api:4000`.
The web Dockerfile accepts the value as an `ARG`, sets it as `ENV` before
`next build`, and the Compose service provides it at runtime too. This avoids
accidentally baking a host-only `localhost` URL into the Docker image.

Express CORS remains restricted to `FRONTEND_URL`, but the web application no
longer depends on CORS because its browser calls are same-origin. The README
will describe this boundary and why CORS is retained only for deliberate
direct API consumers.

The proxied API responses use these envelopes:

```ts
type ApiSuccess<T> = { data: T };
type ApiFailure = { error: { code: string; message: string } };
```

| Purpose | Endpoint | Browser payload / result |
| --- | --- | --- |
| Register passenger | `POST /api/auth/register` | `{ name, email, password }` -> public user and cookie |
| Login | `POST /api/auth/login` | `{ email, password }` -> public user and cookie |
| Session check | `GET /api/auth/me` | public user |
| Logout | `POST /api/auth/logout` | clears cookie |
| Fare estimate | `POST /api/rides/estimate` | `{ pickupZone, destinationZone, seats }` -> poysha and formatted fare |
| Create ride | `POST /api/rides` | same request body -> owned ride |
| List rides | `GET /api/rides/me` | owned rides, newest first |
| Refresh current ride | `GET /api/rides/:rideId` | owned ride |
| Cancel requested ride | `POST /api/rides/:rideId/cancel` | updated owned ride |

The dashboard selects the first non-terminal ride from the newest-first list
as the current ride. Terminal means `COMPLETED` or `CANCELLED`. Only the
current ride receives detail polling; all other rides remain in the history
list. If a poll becomes terminal, the UI reloads the list to find another
active ride or stops polling.

The API returns `estimatedFarePoysha`, the stored solo estimate. The UI labels
it as "Estimated solo fare". It does not claim this is the final pooled fare.

## Routes and Access Rules

| Route | Purpose | Session behavior |
| --- | --- | --- |
| `/` | Minimal entry redirect | Send the visitor to `/login`. |
| `/login` | Existing-user access | Redirect authenticated users by role. |
| `/register` | Passenger registration | Redirect successful registration to `/passenger`. |
| `/passenger` | Passenger dashboard | `GET /api/auth/me`; redirect unauthenticated users to `/login` and drivers to `/driver`. |
| `/driver` | Driver UI placeholder | Show an honest "Driver workspace is coming next" state for drivers; redirect passengers to `/passenger` and unauthenticated users to `/login`. |

These guards improve navigation only. Express remains the authorization
authority for every protected API read or write.

## UI Architecture

### Shared browser client

`src/lib/api/client.ts` owns the fixed `/api` base path, JSON request
serialization, `credentials: "include"`, success-envelope unwrapping, and a
typed `ApiError`.
Small domain wrappers in `src/lib/api/auth.ts` and `src/lib/api/rides.ts` expose
only the operations in the existing API table. Frontend domain types live in
`src/lib/api/types.ts`; they mirror the public API response rather than server
repository types.

### Session and navigation

`src/components/auth/session-guard.tsx` is a client component that loads the
current user and performs role redirects. Public auth forms redirect after the
user returned by login/register, without reading a cookie. A small logout
button calls the real logout endpoint before routing to `/login`.

### Passenger dashboard

`src/app/passenger/page.tsx` composes a dashboard shell and a client
`PassengerDashboard`. Its units have one job:

- `RideRequestForm` owns form fields, immediate client-side constraints, a
  400 ms debounced fare-estimate request after all values become valid, and ride
  creation. It disables every form control and its submit action while a
  current ride is active, showing "You already have a ride in progress."
  Pickup and destination use the exact `DHAKA_AREAS` enum values; seats allow
  only 1–3.
- `CurrentRideCard` renders API status, route, seat count, timestamp, and
  estimated solo fare. It presents a cancel button only for `REQUESTED`.
- `usePassengerRides` fetches the list, derives the newest active ride, polls
  its detail endpoint every 5,000 ms, updates state from create/cancel, and
  clears its interval on unmount or terminal status.
- `RideHistory` renders owned rides excluding the current active ride and an
  honest empty state when none exists.

Polling never overlaps requests: a ref tracks an in-flight refresh. Failed
polls retain the last successful ride and show a non-destructive retry notice;
they do not log the user out. A `401` from any protected API call clears local
session state and routes to `/login`.

### Visual system

Tailwind CSS and the repository's shadcn/ui conventions provide accessible
buttons, form controls, cards, badges, and alerts. The look is clean and
premium but product-owned: deep slate/indigo surfaces, warm green for live
states, an abstract `Bullet` vehicle icon built from Lucide primitives, and
plain text `Dhaka Tesla Pool`. There is no Tesla logo, "T" glyph, wordmark
styling, or copied Tesla visual asset.

The dashboard is one column on mobile and a two-column form/current-ride
layout on desktop, with history below. Status badges have text labels as well
as color so the UI does not rely on colour alone.

## Error and State Behavior

| Condition | UI behavior |
| --- | --- |
| First session/list load | Skeleton or concise loading copy; form disabled only while its own mutation is pending. |
| No rides | Show the request form and a clear invitation to request the first ride. |
| Active ride | Disable the request form and explain that one ride is already in progress. |
| Invalid form | Inline field message; do not call estimate/create until pickup, destination, and seats are valid. |
| Same pickup and destination | Destination field explains the areas must differ. |
| Estimate/create error | Display API message near the form and preserve entered values. |
| `REQUESTED` ride | Show the real cancel action. |
| `MATCHED`, `DRIVER_ARRIVED`, `STARTED` ride | Show status and no cancel action. |
| Terminal ride | Stop polling and place it in history. |
| `401` | Route to login; do not show protected stale data. |
| Driver at passenger route / passenger at driver route | Redirect to the correct role workspace. |

## Testing Strategy

The web package currently has no component-test runner. Add Vitest, jsdom,
React Testing Library, and `@testing-library/user-event` as development
dependencies, with a separate `test` script. Tests operate at the app's public
boundaries and mock only the browser network client.

Coverage must prove these behaviors:

1. The API client calls relative `/api` paths with credentials, unwraps a
   success envelope, and maps a structured error to `ApiError`.
2. Login redirects a passenger to `/passenger` and a driver to `/driver`.
3. The request form sends the exact pickup, destination, and seat values,
   displays the API-provided solo estimate, and preserves values on failure.
4. A requested ride exposes cancellation; a matched/started ride does not.
5. Active rides schedule a five-second refresh, update on a poll, and stop on
   `COMPLETED`/`CANCELLED` or unmount.
6. An active ride disables the request form; terminal/no-ride,
   unauthenticated, and driver-placeholder experiences render the expected
   accessible outcome.
7. The Next rewrite and Docker build configuration use private
   `API_INTERNAL_URL`, never `NEXT_PUBLIC_API_URL`, with `http://api:4000` for
   the Compose web service.

## Documentation

Add a README section using this decision format:

- **Chosen:** Tailwind CSS plus shadcn/ui-style local components.
- **Alternatives:** CSS Modules and a fully packaged component library such as
  Material UI.
- **Why:** fast responsive implementation, token consistency, and components
  that remain local, inspectable source for an internship MVP.
- **Trade-off:** the project owns component maintenance and does not receive a
  large suite of prebuilt widgets.
- **Switch when:** complex data grids, enterprise accessibility primitives, or
  a design team/system justify a more complete maintained library.

Add the same format for Vitest plus React Testing Library: chosen for fast
component and interaction tests in the existing TypeScript stack; alternatives
are Jest plus Testing Library and browser E2E tests; the trade-off is that
jsdom is not a full browser; switch when end-to-end, multi-browser validation
becomes a delivery requirement. Also document the same-origin Next rewrite,
the private `API_INTERNAL_URL`, and retained restricted Express CORS.

## Acceptance Checklist

- A new passenger can register, land on `/passenger`, estimate a route, create
  a ride, and see its `REQUESTED` state.
- Nusrat can log in with the seeded credentials and see only her rides.
- A driver login lands on `/driver`, not the passenger dashboard.
- A real driver lifecycle change appears on Nusrat's active ride within one
  five-second poll interval while it is active.
- Polling ends after cancellation or completion.
- The UI never presents the solo estimate as a final pooled fare and does not
  display unavailable passenger pool history.
- Branding is original and contains no Tesla branding assets or wordmark
  imitation.
