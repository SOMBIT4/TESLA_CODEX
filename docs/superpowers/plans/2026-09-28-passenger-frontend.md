# Passenger Frontend Implementation Plan

For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

Goal: Deliver a responsive, same-origin passenger web experience for authentication, fare estimation, ride creation, active-ride polling, owned history, and valid cancellation.

Architecture: Browser requests use relative /api URLs through a Next.js rewrite to private API_INTERNAL_URL. Express remains the authorization and cookie authority. A typed browser client and domain wrappers isolate API envelopes. A passenger hook owns list refresh, five-second active-ride polling, and mutation state.

Tech Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, local shadcn/ui-style components, Lucide, Vitest, jsdom, React Testing Library, user-event, Docker Compose.

Spec: docs/superpowers/specs/2026-09-28-passenger-frontend-design.md

## Global Constraints

- Browser code uses only relative /api requests with credentials include. Do not add NEXT_PUBLIC_API_URL or browser token storage.
- API_INTERNAL_URL is http://localhost:4000 for host development and http://api:4000 for the Compose web build/runtime.
- Existing Express CORS stays restricted to FRONTEND_URL; web functionality does not rely on it.
- No Express routes, migrations, or database changes belong in this branch.
- Use original Dhaka Tesla Pool and Bullet text/graphics only. Do not use Tesla assets, Tesla T glyphs, or wordmark imitation.
- Label the stored solo estimate Estimated solo fare. Do not invent final pooled fare or pool history.
- Disable every request-form control while a non-terminal current ride exists. Show exactly: You already have a ride in progress.
- Poll only the current non-terminal ride every 5,000 ms. Stop and clean up on COMPLETED, CANCELLED, or unmount.
- The user performs all Git actions. The branch ends with one manual commit.

## Review Focus

- API_INTERNAL_URL must exist before next build; Docker cannot bake a host localhost URL into the web image.
- An unmounted, failed, or terminal poll must not update stale UI or leave an interval active.
- Role redirects use the public user returned by auth APIs, never a client-decoded token.
- A stale fare estimate must not replace the estimate for a newer route.
- The form lock improves presentation only and does not replace API authorization.

---

### Task 1: Same-origin proxy and web test harness

Files:
- Modify: apps/web/package.json and pnpm-lock.yaml
- Create: apps/web/vitest.config.ts, apps/web/src/test/setup.ts, apps/web/tests/next-config.test.ts
- Modify: apps/web/next.config.ts, apps/web/Dockerfile, docker-compose.yml, .env.example

Interfaces:
- Produces the web test command and a Next rewrite from /api/:path* to the private API internal URL.
- Consumes process.env.API_INTERNAL_URL and existing web/api Compose services.
- Produces jsdom test setup and browser-safe /api boundary for later tasks.

- [ ] Step 1: Add Vitest, jsdom, React Testing Library, user-event, jest-dom, and Vite React plugin as web dev dependencies. Add test script with Vitest run mode and configure jsdom, the @ path alias, React transform, and jest-dom setup.
- [ ] Step 2: Write failing next config test. Set API_INTERNAL_URL to a test internal URL and set a conflicting NEXT_PUBLIC_API_URL. Import real next config, call rewrites, and assert only the private internal URL is used for /api/:path*.
- [ ] Step 3: Run pnpm --filter @dhaka-tesla-pool/web test -- tests/next-config.test.ts. Expected: fail because current Next config has no rewrite.
- [ ] Step 4: Implement async rewrites in next.config.ts with private API_INTERNAL_URL host-development default. In web Dockerfile declare API_INTERNAL_URL build ARG and ENV before the web build, then repeat ARG/ENV for runtime. In Compose set the web build argument and runtime variable to fixed http://api:4000. Replace NEXT_PUBLIC_API_URL in root .env.example with API_INTERNAL_URL=http://localhost:4000.
- [ ] Step 5: Re-run the focused test and docker compose config. Expected: test passes and Compose exposes private API_INTERNAL_URL for the web service at build and runtime.

### Task 2: Typed relative API client and frontend utilities

Files:
- Create: apps/web/src/lib/api/types.ts, client.ts, auth.ts, rides.ts
- Create: apps/web/src/lib/constants/areas.ts and apps/web/src/lib/format/money.ts
- Create: apps/web/tests/api-client.test.ts and apps/web/tests/ride-format.test.ts

Interfaces:
- Produces apiRequest, ApiError, auth wrappers, ride wrappers, DHAKA_AREAS, RideStatus, isTerminalRideStatus, and formatPoysha.
- Consumes existing public auth and rides API response shapes.
- Produces all browser calls and displayed ride data for Tasks 3 and 4.

- [ ] Step 1: Write failing client/formatter tests. Assert apiRequest auth me calls fetch with /api/auth/me and credentials include, unwraps data, and maps structured errors into ApiError. Assert 8600 formats as ৳86, 8655 as ৳86.55, and only COMPLETED/CANCELLED are terminal.
- [ ] Step 2: Run pnpm --filter @dhaka-tesla-pool/web test -- tests/api-client.test.ts tests/ride-format.test.ts. Expected: fail because utilities do not exist.
- [ ] Step 3: Implement only public user, estimate, and ride data. Wrap register/login/me/logout and estimate/create/list/get/cancel. Copy the server zone enum exactly: Banani, Gulshan 1, Gulshan 2, Mohakhali, Dhanmondi, Mirpur, Uttara, Farmgate, Bashundhara. Keep JSON/error handling in client and UI behavior elsewhere.
- [ ] Step 4: Re-run focused tests. Expected: pass with relative URL, credentials, errors, formatting, and status behavior proven.

### Task 3: Session-aware pages and role routing

Files:
- Create: apps/web/src/components/auth/login-form.tsx, register-form.tsx, session-guard.tsx
- Create: apps/web/src/components/layout/app-header.tsx
- Create: apps/web/src/app/(public)/login/page.tsx and register/page.tsx
- Create: apps/web/src/app/passenger/layout.tsx and apps/web/src/app/driver/page.tsx
- Modify: apps/web/src/app/page.tsx
- Create: apps/web/tests/auth-flow.test.tsx and role-workspace.test.tsx

Interfaces:
- Consumes Task 2 auth wrappers and public user roles.
- Produces public auth routes, SessionGuard, header/logout action, and driver placeholder.
- Produces passenger layout restricted by the PASSENGER role for Task 4.

- [ ] Step 1: Write failing tests at the auth API boundary. Assert passenger login redirects to /passenger; driver login redirects to /driver; registration redirects to /passenger. Assert passenger guard sends drivers to /driver, driver placeholder sends passengers to /passenger, and drivers see Driver workspace is coming next.
- [ ] Step 2: Run pnpm --filter @dhaka-tesla-pool/web test -- tests/auth-flow.test.tsx tests/role-workspace.test.tsx. Expected: fail because routes, forms, and guard do not exist.
- [ ] Step 3: Implement accessible labelled forms with pending/error state and no token storage. Route only after the auth wrapper returns the public user. Redirect root to login, guard passenger layout, add lightweight original Dhaka Tesla Pool/Bullet header and logout, and create honest driver placeholder. Use generic Lucide vehicle/navigation icons only.
- [ ] Step 4: Re-run focused tests. Expected: pass with role-routing and accessible placeholder behavior proven.

### Task 4: Passenger ride request, lifecycle display, and polling

Files:
- Create: apps/web/src/hooks/use-passenger-rides.ts
- Create: apps/web/src/components/passenger/ride-request-form.tsx, current-ride-card.tsx, ride-history.tsx, passenger-dashboard.tsx
- Create: apps/web/src/app/passenger/page.tsx
- Create: apps/web/tests/passenger-dashboard.test.tsx, ride-request-form.test.tsx, use-passenger-rides.test.tsx

Interfaces:
- Consumes Task 2 ride wrappers/types/formatters and Task 3 passenger route.
- Produces live dashboard and usePassengerRides state: rides, currentRide, loading, error, createRide, cancelRide.

- [ ] Step 1: Write failing behavior tests using literal ride fixtures. Assert loading has accessible loading copy, no rides enables form, and API failure has alert semantics. Assert active REQUESTED disables every form control with exact in-progress message and exposes cancel; MATCHED/STARTED hide cancel. With fake timers, prove a current ride fetch after 5,000 ms updates card and stops for COMPLETED, CANCELLED, or unmount. Assert Banani to Mohakhali with one seat sends exactly those values, renders API fare ৳86, and preserves inputs on estimate error. Assert older delayed estimate cannot replace newer route estimate.
- [ ] Step 2: Run the three focused test files. Expected: fail because dashboard components and hook do not exist.
- [ ] Step 3: Implement current ride as first newest non-terminal list entry. Fetch list initially and after create/cancel. Poll only current ride detail every 5,000 ms with no-overlap ref; after terminal result reload list and stop/recreate polling based on next active ride; clear interval on unmount. Preserve successful display on non-401 poll error and redirect login on protected 401.
- [ ] Step 4: Implement 400 ms debounced estimate with sequence guard. Render mobile one-column and desktop request/current ride grid. Label estimated solo fare; history excludes current active ride and does not claim unavailable final fare/history.
- [ ] Step 5: Re-run focused tests. Expected: pass for form lock, request, cancellation, polling, stale estimate, and terminal cleanup.

### Task 5: Local UI primitives, visual system, and documentation

Files:
- Create: apps/web/src/components/ui/badge.tsx, card.tsx, input.tsx, label.tsx, skeleton.tsx, alert.tsx
- Modify: apps/web/src/app/globals.css, README.md, docs/PROJECT_STATUS.md
- Create: apps/web/tests/ui-states.test.tsx

Interfaces:
- Consumes Task 3 and 4 component needs plus existing Button and cn.
- Produces reusable local UI primitives and documented technology/network decisions.

- [ ] Step 1: Write failing local-primitive tests. Render absent Badge, Alert, and Skeleton directly and assert a status name remains textual, Alert supplies role alert, and Skeleton supplies accessible loading text. These tests fail because local shadcn-style primitives do not exist yet.
- [ ] Step 2: Run pnpm --filter @dhaka-tesla-pool/web test -- tests/ui-states.test.tsx. Expected: fail because state UI/primitives are absent.
- [ ] Step 3: Implement only required local components using existing shadcn/ui tokens and class variance patterns. Extend slate/indigo and live-state color tokens without Tesla assets or wordmark styling. Update README in decision format for Tailwind/shadcn and Vitest/RTL. Document relative api rewrite, private API_INTERNAL_URL Docker build/runtime wiring, and retained restricted Express CORS. Update project status with frontend outcome and API-read limitations.
- [ ] Step 4: Re-run focused test. Expected: pass with accessible primitive behavior proven; Task 4 already proves dashboard loading, empty, error, and status behavior.

### Task 6: Full verification and manual Git handoff

Files:
- Modify only when verification identifies a defect in Tasks 1 through 5.

Interfaces:
- Consumes completed web implementation and workspace suite.
- Produces verified branch ready for user manual commit and PR.

- [ ] Step 1: Run pnpm test, pnpm typecheck, pnpm lint, pnpm build, pnpm format:check, docker compose config, and docker compose up --build.
- [ ] Step 2: With Docker available, browse localhost:3000 and confirm login requests use /api/auth/login rather than a direct localhost:4000 API URL.
- [ ] Step 3: Review poll cleanup, active form lock, role routing, solo-fare labels, and absence of Tesla assets. Record environment-only gaps accurately.
- [ ] Step 4: Stop without any Git operation. Tell user to exclude generated apps/web/next-env.d.ts if build modified it, then give one manual commit message and merge description.

