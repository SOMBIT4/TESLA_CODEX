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

## Source Documentation

The original documentation pack is preserved in [`dhaka-tesla-pool-docs/`](dhaka-tesla-pool-docs/). The PRD, engineering blueprint, and five-page challenge brief remain the source material for implementation decisions.

Maintained implementation documentation begins in [`docs/`](docs/README.md), including the [architecture](docs/ARCHITECTURE.md), [ERD](docs/ERD.md), and [project status](docs/PROJECT_STATUS.md).

## Current Bootstrap Milestone

The repository foundation is established. This milestone includes the Node.js workspace, runnable web and API boundaries, Tailwind/shadcn/ui foundation, Docker service definitions, and verification commands. Database migrations, authentication, ride flows, pooling, and lifecycle behavior are staged for later feature branches.

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

## Docker

The initial Compose topology contains `web`, `api`, and `db` services:

```powershell
docker compose config
docker compose up --build
```

Database migrations and seeds are intentionally deferred to the database feature milestone.

## Verification

The bootstrap checks are:

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
docker compose config
```

The first four commands run in the current workspace. Docker Compose verification requires Docker Desktop to be installed and running.

## Git Workflow

The project follows the documented feature-branch flow in [`dhaka-tesla-pool-docs/docs/GIT_WORKFLOW.md`](dhaka-tesla-pool-docs/docs/GIT_WORKFLOW.md). The first manual checkpoint is:

```text
Branch: master
Commit: chore(repo): initialize node monorepo structure
```

Codex will not create the remote, push to GitHub, or commit on the user's behalf.
