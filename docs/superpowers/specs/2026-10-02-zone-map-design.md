# Zone Map Design

**Status:** Approved  
**Date:** 2026-10-02  
**Branch:** `feature/zone-map` (created and managed by the project owner)

This approved design supersedes the SVG-only map proposal in
`docs/superpowers/plans/2026-09-30-zone-map.md`. That older plan must not be
used for implementation. The existing landing-page SVG remains unchanged.

## Goal

Add maps as an optional visual and selection layer over the existing Dhaka Tesla Pool experience. The map must use the existing backend zone identifiers and current API data. Current forms, fare calculations, ride behavior, endpoints, and database remain unchanged.

The map shows approximate zone locations. It does not represent a precise pickup address, navigation route, or live vehicle location.

## Scope and non-goals

In scope:

- A reusable, client-only Leaflet map using OpenStreetMap raster tiles.
- Passenger pickup and destination selection by map marker, synchronized with the existing dropdowns.
- A driver map showing the active pool pickup and active members' destination zones from the existing active-pool response.
- A non-interactive decorative map on login and registration screens.
- A configurable tile URL, visible attribution, failure fallbacks, tests, and README documentation.

Out of scope:

- Changes to backend code, API endpoints or response shapes, fare logic, database schema, or existing ride rules.
- Browser geolocation, live driver tracking, address search/geocoding, arbitrary coordinates sent to the API, route calculation, traffic, ETA, or turn-by-turn navigation.
- New map-dependent behavior on authentication forms.

## Source of truth and zone positions

The backend's existing `DHAKA_AREAS` export in `apps/api/src/modules/fares/fare-rules.ts` remains the canonical list of valid zones and request values. The web app keeps a coordinate lookup keyed by those existing zone values. That lookup adds only approximate latitude/longitude and translated display labels; it must not define new valid zones or alter fare distances. The current web API types also contain a zone list for form typing, so the coverage test compares that list with the backend export as well as with the map coordinate keys.

A coverage test compares both frontend zone values and coordinate keys with the canonical backend zone list and fails for a missing, unexpected, or differently ordered entry. The browser map does not import or execute backend modules at runtime. No API or shared-package change is required.

The coordinate sanity test uses this broad Dhaka QA envelope: latitude `23.65` through `23.95` and longitude `90.25` through `90.55`. All nine supported zones must fall inside it. The initial map view fits all nine zone positions.

Coordinates identify approximate area centers for marker placement, not exact pickup points. Any path drawn between zones is a visual connector only and must not be described as a navigable or distance-accurate route. The implementation may omit a connector if it could be mistaken for routing.

## Shared map component

The web app provides a reusable `ZoneMap` client component. Its inputs are the selected zones, a selection mode, map presentation mode, and callbacks for zone selection. It renders large circle markers and never reads geolocation or sends coordinates to the API.

The map is loaded through a client boundary with Next.js dynamic loading and `ssr: false`. Leaflet's stylesheet is included through the web app's supported stylesheet path. A map container has a fixed responsive minimum height so it can initialize correctly on desktop and mobile.

Each mounted map creates its Leaflet map instance once. Poll responses update existing marker layers in place when displayed data changes. A deterministic signature of the sorted set of displayed zone IDs controls viewport fitting: the initial fit includes all nine supported zones, then `fitBounds` runs only when that zone set changes. Changes to member names or seat counts update marker labels without resetting the view. Re-rendering or polling with identical data must not recreate marker instances or call `fitBounds` again.

The component supports these presentation modes:

- **Selectable:** pickup and destination markers are interactive.
- **Pool overview:** one pickup marker and one marker for each distinct destination zone; members sharing a destination are grouped into that marker.
- **Decorative:** all nine zone markers are read-only, map controls and keyboard handling are disabled, all map interactions are disabled, and the map canvas is hidden from assistive technology.

The tile layer uses `NEXT_PUBLIC_MAP_TILE_URL`, defaulting to `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. The value is public configuration, not a secret. Next.js embeds `NEXT_PUBLIC_` values when building the browser bundle, so the web Docker build must receive the value at build time. The variable belongs in `.env.example`, the web Docker build configuration, and the README. Changing it for a built image requires rebuilding that image.

Interactive maps display visible `© OpenStreetMap contributors` attribution. In decorative mode, the Leaflet canvas is inside an `aria-hidden` wrapper and the attribution is rendered as visible text outside that wrapper, so no focusable attribution element is hidden from assistive technology. The tile URL stays configurable so a different compatible provider can be chosen later. The public OSM tile service is best-effort and has no service-level availability guarantee; this implementation is suitable for the internship demo and must not assume unlimited production capacity.

## Passenger page

The passenger ride request form keeps its existing pickup and destination dropdowns. A two-option control explicitly chooses whether the next map tap sets **Pickup** or **Destination**; Pickup is selected by default. Tapping a zone marker updates only the selected field. Pickup is shown in green and destination in red. Changing a dropdown updates the corresponding map marker, and changing a map marker updates the dropdown value.

When the existing request form is disabled because a ride is active or an action is pending, map marker selection is disabled as well. The map is read-only in this state; it cannot update the form or trigger a fare request.

The form submits the same existing zone values and uses the existing fare-estimate API. Coordinates are never submitted, and the map never calculates or overrides a fare. Existing validation remains authoritative, including the rejection of identical pickup and destination zones.

Acceptance example: selecting Banani as pickup and Mohakhali as destination continues to show the backend-provided **86.00 Tk** solo fare for Nusrat. A tile error must not disable the dropdowns, fare estimate, or ride submission. The UI shows a brief map-unavailable fallback while leaving the existing form usable.

## Driver page

When the driver has an active pool, the map uses the existing active-pool response only:

- One pickup marker for the pool's pickup zone.
- One marker per distinct destination zone among members included in that response. The marker lists every member's passenger name and seat count for that destination.

The map does not request or display passenger email, passenger ID, or precise location. If a dropped-off member is absent from the API response, the UI does not retain that member or invent a completed marker. If two or more active members share a destination, one marker lists all their names and seats. If there is no active pool, the current no-active-pool state remains unchanged. If tiles fail, the current pool details and actions stay available without the map.

## Login and registration screens

Login and registration receive a read-only, decorative OSM map layer using the same tile configuration. The map sits behind the authentication form panel; the existing route illustration remains unchanged in its separate panel. It does not change form state, capture map input, delay form use, or sit over clickable fields. The Leaflet canvas has `pointer-events: none`; a readability overlay preserves text contrast. Zoom controls, keyboard handling, and all map interactions are disabled. The canvas is marked `aria-hidden`, with visible attribution text outside that wrapper. If tiles cannot load, the page uses its existing plain background treatment; authentication continues normally.

The map displays no user location or account-specific data. The implementation does not call browser geolocation.

## Failure and accessibility behavior

- A tile-load error changes only the map presentation; it does not become an API or ride-form error.
- Tile failures and caught Leaflet initialization failures switch only the map to its local fallback. A component render/import crash is contained by a map-specific error boundary. Neither failure path can break passenger form controls, driver actions, or authentication forms.
- Passenger dropdowns remain the complete non-map alternative and keyboard-accessible selection path.
- The pickup/destination selection mode is visibly labeled and announced to assistive technology.
- Marker names include the zone label and role (pickup or destination). Driver markers include only the returned passenger name and seat count.
- Decorative authentication maps are non-interactive and `aria-hidden`.
- Decorative map attribution remains visible outside the `aria-hidden` canvas; the map has no zoom control, keyboard handling, pointer input, or other interaction.
- Map initialization waits until the client component is mounted; no server-rendered Leaflet object is created.
- The passenger map is read-only whenever the existing ride-request form is disabled.

## Tests

Add web tests for:

1. Coordinate lookup coverage exactly matches the nine-zone backend list, and every coordinate is inside the specified Dhaka QA envelope.
2. Map selection updates the same existing pickup/destination values as the dropdowns, and dropdown selection updates the map state.
3. The request payload after map selection contains the same zone values as the equivalent dropdown selection.
4. When the passenger form is disabled by an active ride or pending action, map clicks do not update a zone or request a new estimate.
5. Passenger fare remains sourced from the existing API response; Banani to Mohakhali continues to show 86.00 Tk in the existing fare test/flow.
6. Tile failure and a simulated Leaflet initialization failure leave passenger dropdowns and ride actions usable; a component render crash is contained by the map error boundary.
7. Driver markers are derived only from current active-pool response members; absent dropped-off members do not produce a done marker.
8. Two members with the same destination render as one destination marker listing both names and seat counts.
9. Polling with identical active-pool data does not recreate the Leaflet map or markers and does not call `fitBounds` again.
10. Login and registration maps are decorative, keep attribution visible outside the `aria-hidden` map canvas, do not intercept form interaction, and degrade to the existing plain background on tile or initialization failure; a component render crash is contained by the map error boundary.

Leaflet and tile-network behavior should be mocked in automated tests. Tests must not depend on OpenStreetMap availability. All existing API and web test suites must remain green.

## README updates

Document:

- Why Leaflet was selected over a hand-drawn SVG: Leaflet provides a real pan-and-zoom map with geographic tiles and marker interactions; SVG would be lighter and deterministic offline but would require maintaining a custom map illustration and interaction layer.
- Visible OpenStreetMap attribution and the external tile-service availability limitation.
- `NEXT_PUBLIC_MAP_TILE_URL`, its default, and the fact that the web bundle reads it at build time, including Docker build configuration. Changing this variable on the deployment host requires rebuilding the web image.
- That coordinates are approximate zone centers and do not enable geocoding, live tracking, routing, or fare calculation.

## Acceptance criteria

- The implementation is additive: no existing endpoint, API response shape, fare rule, database object, or ride behavior changes.
- Every backend zone has exactly one map position, and no new zone is introduced by the map.
- Map and dropdown selections remain synchronized and submit the same existing zone values.
- Banani to Mohakhali still displays the backend-calculated 86.00 Tk solo fare.
- The driver map uses only the existing active-pool response and never exposes email or passenger ID.
- Members sharing a destination appear together in one marker with all names and seat counts.
- Repeated identical polling preserves the map instance, marker instances, and current view; bounds are refit only when the set of displayed zones changes.
- All nine coordinates pass the Dhaka bounding-box test and the initial view fits all nine zones.
- Login and registration remain fully usable with the map disabled or tiles unavailable.
- A startup crash in the map is contained and does not break surrounding screens or actions.
- OSM attribution is visible, the tile URL is configurable, and all existing test suites pass.

## Implementation boundary

No implementation, dependency installation, or Git operation is part of this design review. After this design is approved, the next step is a concrete implementation plan with tasks, file boundaries, and verification commands. The project owner will create `feature/zone-map` and handle all commits and pushes.
