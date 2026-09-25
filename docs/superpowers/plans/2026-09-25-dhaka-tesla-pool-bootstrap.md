# Dhaka Tesla Pool Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a runnable Node.js monorepo baseline for Dhaka Tesla Pool with a Next.js/Tailwind/shadcn/ui web app, an Express/TypeScript API health endpoint, Docker Compose scaffolding, and documented local commands.

**Architecture:** Keep the repository root as a small npm workspace. `apps/web` owns the Next.js App Router frontend and `apps/api` owns the Express API. PostgreSQL is represented in Compose and environment configuration at this stage, but schema and business behavior belong to the next database feature branch.

**Tech Stack:** Node.js, npm workspaces, TypeScript, Next.js App Router, Tailwind CSS, shadcn/ui, Express, Zod, Vitest, Docker Compose, PostgreSQL service placeholder.

**Spec:** `docs/superpowers/specs/2026-09-25-dhaka-tesla-pool-design.md`

## Global Constraints

- Use Node.js with TypeScript for all application code.
- Use Next.js App Router for the web application.
- Use Tailwind CSS and shadcn/ui for the web foundation.
- Keep backend dependencies flowing route -> middleware -> controller -> service -> repository -> database.
- Do not add database schema or domain features in this bootstrap milestone.
- Do not commit secrets; `.env` is ignored and `.env.example` contains placeholders only.
- Do not push to GitHub or create external GitHub state; the user performs Git operations manually.
- Preserve `dhaka-tesla-pool-docs/` as the source/reference documentation pack.
- Use meaningful commit wording; the first manual checkpoint is `chore(repo): initialize node monorepo structure` on `master`.

## Review Focus

- A fresh checkout must install dependencies from the root and address both apps through workspace scripts.
- The API must start without a database connection and return a stable JSON health response from `GET /health`.
- The web app must start with Tailwind styles and a shadcn/ui-compatible utility foundation rather than a placeholder CSS setup.
- Missing or unsafe environment variables must fail with a readable startup error, while the bootstrap API must not require PostgreSQL.
- Docker Compose must describe web, API, and PostgreSQL services without embedding real secrets or relying on undocumented host state.

---

### Task 1: Create the root Node.js workspace and repository guardrails

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `README.md`
- Create: `docs/README.md`
- Create: `docs/PROJECT_STATUS.md`

**Interfaces:**
- Produces root npm scripts named `dev`, `dev:web`, `dev:api`, `build`, `lint`, `test`, `format:check`, and `typecheck`.
- Produces workspace packages `apps/web` and `apps/api` for later tasks.
- Documents that the existing `dhaka-tesla-pool-docs/` directory is the source pack and that the first milestone excludes database schema.

- [ ] **Step 1: Write the root workspace manifest**

Create `package.json` with npm workspaces and scripts that delegate to the two apps without requiring a database. Install the current compatible versions of `@types/node`, `concurrently`, `prettier`, and `typescript` with npm, and retain the resolved versions in `package.json` and `package-lock.json` rather than using floating version labels:

```json
{
  "name": "dhaka-tesla-pool",
  "private": true,
  "workspaces": ["apps/web", "apps/api"],
  "scripts": {
    "dev": "concurrently -n web,api -c blue,green \"npm:dev:web\" \"npm:dev:api\"",
    "dev:web": "npm --workspace apps/web run dev",
    "dev:api": "npm --workspace apps/api run dev",
    "build": "npm run build --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "format:check": "prettier --check .",
    "typecheck": "npm run typecheck --workspaces --if-present"
  }
}
```

Run `npm install --save-dev @types/node concurrently prettier typescript` from the repository root to write the exact resolved dependency versions into the manifest and lockfile.

Add the minimal root configuration required by those scripts, without adding a database dependency.

- [ ] **Step 2: Add ignore rules and environment placeholders**

`.gitignore` must ignore `node_modules`, `.next`, build output, coverage, local `.env` files except `.env.example`, editor files, logs, and Docker override files. `.env.example` must contain only placeholders for `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `API_PORT`, `WEB_PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `FRONTEND_URL`, and `NEXT_PUBLIC_API_URL`.

- [ ] **Step 3: Add root TypeScript and documentation stubs**

`tsconfig.base.json` must enable strict TypeScript, ES2022 output assumptions, Node module resolution, and no emitted JavaScript. The root `README.md` must identify the project, link to the source documentation pack and maintained docs, state the stack, list the first milestone's current status, and give exact bootstrap commands. `docs/README.md` must explain which documentation is maintained at the root and where the source pack lives. `docs/PROJECT_STATUS.md` must mark only repository bootstrap as in progress.

- [ ] **Step 4: Verify root files without installing product dependencies**

Run:

```powershell
node --version
npm --version
Get-Content package.json | ConvertFrom-Json | Out-Null
Test-Path .env.example
Test-Path dhaka-tesla-pool-docs\PRD.md
```

Expected: Node and npm are available, `package.json` parses, `.env.example` exists, and the source PRD is preserved.

- [ ] **Step 5: Prepare the manual Git checkpoint**

Do not run `git add`, `git commit`, `git remote`, or `git push`. After all bootstrap tasks and verification pass, hand the user this exact checkpoint:

```text
Branch: master
Commit: chore(repo): initialize node monorepo structure
```

The user will initialize or update Git and perform the first push manually.

### Task 2: Create the Express TypeScript API foundation

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/config/env.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/routes/index.ts`
- Create: `apps/api/src/middleware/error.middleware.ts`
- Create: `apps/api/src/middleware/not-found.middleware.ts`
- Create: `apps/api/src/middleware/request-id.middleware.ts`
- Create: `apps/api/src/shared/errors/AppError.ts`
- Create: `apps/api/src/shared/logger/logger.ts`
- Create: `apps/api/tests/health.test.ts`

**Interfaces:**
- `createApp(): Express` creates the configured API application without opening a listening socket.
- `GET /health` returns `{ "data": { "status": "ok", "service": "api" } }` with HTTP 200.
- `startServer()` reads `API_PORT` from environment and starts the listener.
- Unknown routes return the standard error envelope with code `NOT_FOUND`.

- [ ] **Step 1: Write the failing health test**

Create `apps/api/tests/health.test.ts` using Vitest and Supertest:

```ts
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

describe("GET /health", () => {
  it("returns the API health envelope", async () => {
    const response = await request(createApp()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: { status: "ok", service: "api" },
    });
  });
});
```

Run `npm --workspace apps/api test -- --run tests/health.test.ts`. Expected: FAIL because the API package and `createApp` do not yet exist.

- [ ] **Step 2: Add API dependencies and TypeScript configuration**

Create the API package with Express, CORS, Zod, Supertest, Vitest, and the required Node/Express type packages. Configure `dev`, `build`, `start`, `lint`, `test`, and `typecheck` scripts. Extend `../../tsconfig.base.json` and include `src` and `tests`.

- [ ] **Step 3: Implement environment parsing and the app boundary**

Implement `env.ts` with a Zod schema for `NODE_ENV`, `API_PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, and `FRONTEND_URL`. The bootstrap API must supply development-safe defaults for `API_PORT`, `JWT_SECRET`, and `JWT_EXPIRES_IN` but must never log secrets. `createApp()` must install request IDs, JSON parsing, CORS, `/api` routes, `/health`, not-found handling, and central error handling. It must not connect to PostgreSQL.

- [ ] **Step 4: Implement the health route, errors, and logger**

Use a request ID middleware that adds `X-Request-Id`. Use `AppError` with `code`, `statusCode`, and safe public messages. Return `{ error: { code, message } }` for failures. Log method, path, request ID, and status, but never request bodies, cookies, tokens, passwords, or environment values.

- [ ] **Step 5: Run the test and API checks**

Run:

```powershell
npm --workspace apps/api test -- --run tests/health.test.ts
npm --workspace apps/api run typecheck
npm --workspace apps/api run build
```

Expected: the health test passes, TypeScript passes, and the API build emits only the configured build output.

### Task 3: Create the Next.js, Tailwind, and shadcn/ui web foundation

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/components.json`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/src/components/ui/button.tsx`
- Create: `apps/web/src/lib/utils.ts`

**Interfaces:**
- The web app starts through `npm --workspace apps/web run dev`.
- The root page renders the product name, a short purpose statement, and a shadcn/ui `Button` component.
- Tailwind utility classes are available in the page and component styles.
- `cn(...inputs)` merges class names using `clsx` and `tailwind-merge`.

- [ ] **Step 1: Add the web package and testable foundation**

Create the Next.js package with TypeScript, React, Tailwind CSS, shadcn/ui-compatible dependencies (`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`), and scripts for `dev`, `build`, `start`, `lint`, and `typecheck`. Use the supported App Router structure under `src/app`.

- [ ] **Step 2: Add Tailwind and shadcn/ui configuration**

Configure Tailwind content paths for `src/app` and `src/components`. Configure `components.json` with the `@/` alias, `src/components`, `src/lib/utils`, and CSS variables. Create a minimal button component following the shadcn/ui pattern with variants `default`, `secondary`, `outline`, and `ghost`.

- [ ] **Step 3: Implement the root layout and page**

Create a server-rendered root layout with metadata for Dhaka Tesla Pool and a page that introduces the MVP and renders the button. Keep the page intentionally small; passenger and driver dashboards are later feature tasks.

- [ ] **Step 4: Add global styling**

Define Tailwind layers and shadcn/ui-compatible CSS variables for light and dark themes. The page must remain readable without external assets and must not contain hardcoded secrets or API tokens.

- [ ] **Step 5: Verify the web foundation**

Run:

```powershell
npm --workspace apps/web run typecheck
npm --workspace apps/web run lint
npm --workspace apps/web run build
```

Expected: all commands pass and the production build completes.

### Task 4: Add Docker Compose and local service boundaries

**Files:**
- Create: `docker-compose.yml`
- Create: `apps/api/Dockerfile`
- Create: `apps/web/Dockerfile`
- Create: `database/README.md`
- Create: `scripts/README.md`

**Interfaces:**
- `docker compose config` validates the Compose file without requiring running services.
- Services are named `web`, `api`, and `db`.
- The API container exposes port 4000 and the web container exposes port 3000.
- PostgreSQL uses the environment placeholders and a named volume.

- [ ] **Step 1: Define the PostgreSQL service**

Create a PostgreSQL 16 service with `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` from the root environment, a named volume, and a health check using `pg_isready`. Do not add schema initialization in this bootstrap milestone.

- [ ] **Step 2: Define the API service**

Build from `apps/api/Dockerfile`, expose port 4000, pass `API_PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, and `FRONTEND_URL`, and depend on `db` health. The container must run the API build's `start` script.

- [ ] **Step 3: Define the web service**

Build from `apps/web/Dockerfile`, expose port 3000, pass `NEXT_PUBLIC_API_URL`, and depend on the API service. The container must run the Next.js production start script after the build.

- [ ] **Step 4: Document the database and helper directories**

`database/README.md` must state that migrations and seeds are intentionally deferred to `feature/database-schema` and list the planned migration order. `scripts/README.md` must state that project helper scripts will be added only when they have a verified use case.

- [ ] **Step 5: Validate Compose configuration**

Run:

```powershell
docker compose config
```

Expected: Compose renders a valid configuration for `web`, `api`, and `db` without exposing a real secret.

### Task 5: Integrate documentation and perform the bootstrap verification

**Files:**
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`
- Create: `docs/ARCHITECTURE.md`
- Create: `docs/ERD.md`
- Create: `docs/DEVELOPMENT_PLAN.md`

**Interfaces:**
- Root documentation links to the implementation architecture and source/reference pack.
- Architecture and ERD use Mermaid diagrams consistent with the approved design.
- Project status identifies the completed bootstrap and the next feature branch.

- [ ] **Step 1: Add the maintained architecture and ERD**

Document Browser -> Next.js -> Express -> PostgreSQL, the backend layering rule, the planned domain entities, and the distinction between ride request, pool, and pool membership. Do not claim database tables or features are implemented yet.

- [ ] **Step 2: Add the staged development plan**

List the next feature branches in this order: `feature/database-schema`, `feature/passenger-auth`, `feature/ride-request`, `feature/fare-engine`, `feature/driver-flow`, `feature/tesla-pooling`, `feature/ride-history`, `feature/tests`, `feature/docker`, and `feature/docs`.

- [ ] **Step 3: Run the full bootstrap verification**

Run:

```powershell
npm install
npm run typecheck
npm run lint
npm run test
npm run build
docker compose config
```

Expected: all available workspace checks pass, no test requires PostgreSQL yet, and Compose validation succeeds.

- [ ] **Step 4: Inspect the final change set without Git mutation**

Run:

```powershell
rg --files apps database docs scripts | Sort-Object
rg -n "password|token|secret|DATABASE_URL" --glob "!*.example" --glob "!package-lock.json"
```

Expected: only configuration names or safe documentation references appear; no real credentials are present.

- [ ] **Step 5: Stop for the user's manual Git checkpoint**

Do not stage or commit. Report:

```text
Branch: master
Commit message: chore(repo): initialize node monorepo structure
Push target: origin master
```

Wait for the user to complete the manual GitHub push before beginning `feature/database-schema`.
