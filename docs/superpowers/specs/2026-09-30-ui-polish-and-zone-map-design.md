# Dhaka Tesla Pool UI Polish and Zone Map Design

**Status:** Draft for review

**Date:** 2026-09-30

## Goal

Give passengers and drivers a colorful, professional, and easy-to-use Dhaka
Tesla Pool experience while preserving the existing API contracts, secure
HttpOnly-cookie authentication, and privacy rules.

The work is intentionally split into two feature tracks:

1. `feature/ui-polish`: visual system, authentication pages, localization,
   and dashboard presentation improvements.
2. `feature/zone-map`: interactive zone maps for passenger and driver
   dashboards, built on the current zone-based API.

The user manually stages, commits, pushes, and merges each checkpoint.

## Product decisions

### Brand direction

Use an original Dhaka Tesla Pool identity rather than Tesla's logo or
wordmark. The visual language should feel familiar to ride-sharing users
without copying Pathao or Uber:

- deep navy ink for navigation and primary text;
- indigo or blue as the primary action color;
- teal or emerald for online, active, and success states;
- amber for waiting, estimated, and attention states;
- red only for destructive actions and errors;
- warm off-white surfaces and restrained gradients for depth.

Color meaning must remain understandable without color alone. Status badges
will include text and accessible labels.

### Authentication pages

Login and registration receive the same visual system as the dashboards:

- clear form hierarchy and field labels;
- password visibility control;
- inline validation and server-error messages;
- disabled and pending-submit states;
- keyboard focus styles and usable mobile spacing;
- a static, repository-owned Dhaka route illustration on the visual side of
  the page.

The auth pages will not request location permission or load an interactive map
before a user is signed in. A static illustration gives the pages personality
without adding map cost, privacy prompts, or an unnecessary network failure
point.

### Language support

The first supported locales are English (`en`) and Bangla (`bn`), with English
as the initial default. A language switcher is available on public auth pages
and in the authenticated header.

All user-facing UI copy is moved into a small repository-owned translation
dictionary. The locale preference is stored in `localStorage` after hydration,
with a stable English server render to avoid hydration mismatches. API error
messages remain the server's message when no translated error key exists, with
the existing English message as a safe fallback.

The first translation pass covers navigation, form labels, validation copy,
ride statuses, action labels, empty/loading/error states, fare labels, and map
instructions. User-entered names and zone names are not translated or
rewritten.

### Zone maps

The current domain model stores named Dhaka zones, not latitude/longitude,
addresses, or live device locations. The map feature therefore visualizes and
selects the known `DHAKA_AREAS` rather than pretending to provide turn-by-turn
navigation.

The recommended first implementation is a client-side, repository-owned SVG
zone map with curated coordinates for every supported area:

- no API key or external map service is needed;
- the map works in tests, local Docker, and offline demos;
- markers and route lines are deterministic;
- the provider can later be replaced behind the same `ZoneMap` interface when
  the product adds geocoding or live GPS.

The map alternatives were considered:

| Approach | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Repository-owned SVG zone map | Deterministic, fast, no credentials, matches zone-only API | Not a navigable street map | Recommended now |
| Leaflet with OpenStreetMap tiles | Familiar geographic map and low implementation effort | External tile policy, client-only setup, network dependency | Defer until geographic coordinates exist |
| MapLibre with a hosted vector style | Strong visual control and future extensibility | Requires a style/tile provider and environment configuration | Defer until production map infrastructure is chosen |

The `ZoneMap` interface will accept the supported zones, an optional pickup
zone, an optional destination zone, and an optional set of pool destinations.
The implementation will expose accessible buttons for selectable zones and a
text route summary so the map is never the only way to understand the trip.

Passenger map behavior:

- show the map after the ride form has valid zones or while choosing a zone;
- highlight pickup and destination differently;
- allow marker selection to update the existing form controls;
- draw a simple route line between the selected zones;
- keep the existing seat and fare-estimate flow unchanged.

Driver map behavior:

- show the active pool pickup zone and member destinations;
- show a route summary without passenger email, ID, or ride ID;
- update with the existing active-pool refresh;
- show an empty state when there is no active pool.

No live GPS, geocoding, traffic estimates, external routing, or backend map
endpoints are part of this scope.

## Component and data design

### Shared visual primitives

Use the existing Tailwind and repository-owned shadcn/ui-style primitives.
Extend them only where the redesign needs a reusable pattern:

- page shell and responsive content container;
- app header with locale switcher;
- status badge variants;
- form field and validation message;
- empty, loading, and error panels;
- `ZoneMap` and map legend.

Avoid scattering one-off color values through feature components. Global CSS
tokens and shared class combinations should define the product language.

### Localization boundary

Add a client-side locale provider and a typed translation lookup. Components
receive translated copy through the provider or a small `useI18n` hook; API
modules and domain types remain locale-neutral.

The provider must be safe for Next.js server rendering. It starts with English,
reads the saved preference once on the client, and updates the document's
language attribute when the locale changes.

### Map boundary

Add a zone coordinate module containing only display coordinates for the
existing `DHAKA_AREAS`. It is presentation data, not a replacement for the
database's canonical zone list.

The map component should be presentational and receive typed props. Passenger
and driver hooks remain responsible for API state; the map must not fetch
location data or mutate rides directly.

## User flows

### Passenger

1. Passenger opens the public page and sees the branded value proposition.
2. Passenger registers or logs in using the redesigned form.
3. Passenger lands on the passenger workspace according to the existing role
   redirect.
4. Passenger chooses pickup and destination using the existing controls or
   map markers.
5. Fare estimate, seat selection, active ride, cancellation, and history keep
   their current API behavior while adopting the new visual and localized
   copy.

### Driver

1. Driver logs in and lands on the driver workspace.
2. Driver sees availability, waiting requests, active pool, and completed
   history in a clearer responsive layout.
3. When a pool is active, the zone map shows the pickup and destinations.
4. Lifecycle and per-rider drop-off actions keep their current pending,
   conflict, and refresh behavior.

## Accessibility and responsive behavior

- Every interactive control has an accessible name.
- Map actions are keyboard reachable and have text alternatives.
- Focus-visible styles remain visible against every surface.
- Error and pending states use live-region semantics where appropriate.
- Mobile layouts stack cards and keep primary actions reachable without
  horizontal scrolling.
- Reduced-motion preferences disable decorative map and page animations.
- Contrast must remain readable for text, badges, buttons, and form errors.

## Testing strategy

Tests will stay close to the existing Vitest and React Testing Library setup.

UI polish tests cover:

- locale switching and persisted locale behavior;
- translated auth labels and validation states;
- responsive-safe empty, loading, error, and pending states;
- role-based redirects remaining unchanged;
- no Tesla logo or wordmark appearing in rendered UI.

Map tests cover:

- every supported zone has display coordinates;
- pickup and destination selection updates the expected callback;
- selected zones have distinct visual/accessibility states;
- route summaries remain available without relying on SVG geometry;
- driver maps show only approved pool fields;
- empty active-pool map state renders correctly.

Before each manual checkpoint, run the relevant focused tests. Before merging
each branch, run:

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

## Branches and manual commit checkpoints

### `feature/ui-polish`

Suggested manual commits:

```text
style(web): establish Dhaka Tesla Pool visual system
style(auth): redesign login and registration flows
feat(web): add English and Bengali language switcher
style(passenger): refine passenger ride workspace
style(driver): refine driver operations workspace
test(web): cover polished responsive states
```

### `feature/zone-map`

Create this branch from updated `master` after the UI polish branch merges.

Suggested manual commits:

```text
feat(web): add interactive Dhaka zone maps
test(web): cover passenger and driver map states
```

The agent will stop at each requested checkpoint and provide the exact commit
message. The user performs `git add`, `git commit`, `git push`, and merge.

## Out of scope

- Interactive maps on login or registration pages.
- Real Tesla logos, wordmarks, or copied brand assets.
- Live GPS, driver tracking, turn-by-turn navigation, geocoding, or traffic.
- New backend endpoints or database migrations for visual polish or zone maps.
- Payment processing, notifications, chat, or WebSockets.
