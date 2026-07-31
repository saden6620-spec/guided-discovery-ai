# Guided Discovery AI

Guided Discovery AI is a modular AI platform whose first planned application is an intelligent travel companion. The project is currently at **M1 — Platform Skeleton**.

M1 contains launchable process shells, health endpoints, configuration contracts, native React Native starter projects, and documented module boundaries. It intentionally contains no product behavior, authentication implementation, database schema, AI execution, memory behavior, or plugin runtime.

## Prerequisites

- Node.js 24.18.0 LTS (`>=24 <25`)
- pnpm 11.4.0
- Python 3.13.14 (`>=3.13,<3.14`)
- Docker Engine 29 with Docker Compose v2 or a compatible Docker Desktop release
- Android Studio for Android mobile launches
- macOS, Xcode, and CocoaPods for iOS mobile launches

## Setup

```text
corepack enable
corepack prepare pnpm@11.4.0 --activate
pnpm install --frozen-lockfile
python -m venv .venv
python -m pip install fastapi==0.141.1 pytest==9.1.1 ruff==0.15.22 uvicorn==0.52.0
pnpm exec playwright install chromium
pnpm validate
```

Activate the Python virtual environment before running Python commands.

## Skeleton Layout

- `apps/mobile/`: blank React Native application with Android and iOS native projects
- `apps/*/`: documented future client boundaries
- `backend/*/`: independent NestJS service processes with `GET /health`
- `ai/orchestrator/`: placeholder FastAPI process with `GET /health`
- `ai/*/`: documented AI subsystem boundaries with no AI behavior
- `packages/*/`: documented shared contracts and package boundaries
- `infrastructure/*/`: documented infrastructure boundaries without deployment implementation

The complete authoritative layout is in `Documents/REPOSITORY_STRUCTURE.md`.

## Development Commands

| Command                | Purpose                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `pnpm build`           | Build all runnable TypeScript workspaces through Turborepo      |
| `pnpm format`          | Format supported TypeScript, JavaScript, JSON, YAML, and Python |
| `pnpm format:check`    | Check formatting                                                |
| `pnpm lint`            | Run root and workspace ESLint plus Ruff                         |
| `pnpm typecheck`       | Type-check root configuration and every TypeScript workspace    |
| `pnpm test`            | Run Jest, Pytest, and workspace tests                           |
| `pnpm test:e2e`        | Run Playwright tests                                            |
| `pnpm validate`        | Build and run the complete local validation suite               |
| `pnpm docker:up`       | Build and start the complete runnable skeleton                  |
| `pnpm verify:skeleton` | Verify every backend, AI, and Metro health endpoint             |
| `pnpm docker:down`     | Stop the local skeleton                                         |

## Starting Individual Processes

```text
pnpm --filter @guided-discovery/api-gateway dev
python -m uvicorn app.main:application --app-dir ai/orchestrator --port 8000
pnpm --filter @guided-discovery/mobile start
```

Every backend service accepts `SERVICE_NAME`, `SERVICE_PORT`, `SERVICE_VERSION`, and the placeholder `DATABASE_URL`. The AI placeholder accepts `AI_SERVICE_NAME` and `AI_SERVICE_PORT`. Copy `.env.example` to `.env` for Compose overrides.

## Docker Compose

```text
docker compose config --quiet
docker compose up --build --detach --wait
pnpm verify:skeleton
docker compose down --remove-orphans
```

Compose launches the development workspace, all 16 backend skeletons, the FastAPI AI Orchestrator placeholder, and the React Native Metro server.

## Mobile

```text
pnpm --filter @guided-discovery/mobile start
pnpm --filter @guided-discovery/mobile android
pnpm --filter @guided-discovery/mobile ios
```

The mobile shell contains only a minimal title and subtitle.

## Scope Control

Only the milestone active in `Documents/TASKS.md` may be implemented. M2 remains unstarted.
