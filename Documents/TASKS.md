# TASKS.md

Version: 1.0

---

# Purpose

This document identifies the only milestone currently authorized for implementation.

Only the active milestone may be implemented. Work outside the active milestone must remain deferred until the milestone is changed through explicit approval.

---

# Current Status

- Active phase: Phase 1 — Platform Foundation
- Phase status: Complete
- Active milestone: M1 — Platform Skeleton
- Milestone status: Complete
- Hosted CI validation date: July 31, 2026
- Hosted CI tested branch: `main`
- Next milestone: M2 — Core Backend
- Next milestone status: Not started
- Last reviewed: 2026-07-31

Allowed status values:

- Not started
- In progress
- Blocked
- Complete
- Deferred

---

# M0 — Repository Foundation

## Objective

Establish the repository and development-tooling foundation required for later milestones without implementing product or domain behavior.

## Included Tasks

| Task | Status |
|---|---|
| Create the monorepo | Complete |
| Configure pnpm workspaces | Complete |
| Configure Turborepo | Complete |
| Create the approved top-level directory structure | Complete |
| Configure shared TypeScript settings | Complete |
| Configure ESLint and Prettier | Complete |
| Configure Python formatting, linting, and testing foundations | Complete |
| Add Docker Compose for local development dependencies | Complete |
| Add Dev Container support | Complete |
| Add initial GitHub Actions CI | Complete |
| Add `.env.example` | Complete |
| Add root development scripts | Complete |
| Add a human-readable root `README.md` | Complete |

The approved top-level directory structure is:

- `apps/`
- `backend/`
- `ai/`
- `packages/`
- `infrastructure/`
- `docs/`
- `scripts/`
- `assets/`
- `tests/`
- `tools/`

---

# Acceptance Criteria

M0 is complete only when:

- The repository is configured as a pnpm and Turborepo monorepo.
- Every approved top-level directory exists and follows `REPOSITORY_STRUCTURE.md`.
- Shared TypeScript configuration is available for later packages and applications.
- ESLint and Prettier are configured and runnable from the repository root.
- Python formatting, linting, and testing foundations are configured and runnable.
- Docker Compose defines only the local development dependencies authorized for this milestone.
- The Dev Container can initialize the development environment.
- Initial GitHub Actions CI runs the configured foundation-level quality checks.
- `.env.example` documents required development configuration without containing secrets.
- Root development scripts provide documented entry points for setup and quality checks.
- The root `README.md` explains the project, prerequisites, setup, repository layout, and available development commands in human-readable form.
- No application business logic, backend domain service implementation, AI behavior, database implementation, authentication implementation, or user-facing product feature has been added.
- Documentation remains consistent with the authoritative repository structure and technology stack.
- All M0 task statuses are updated accurately.

---

# Explicitly Out of Scope

The following must not be implemented during M0:

- Application business logic
- Backend domain services
- AI behavior or model integration
- Database schemas, migrations, or persistence
- Authentication or authorization behavior
- User-facing product features

Scaffolding may establish approved directories and development configuration, but it must not introduce the behavior listed above.

---

# Deferred Work

All work outside M0 is deferred, including:

- Additional Phase 1 work beyond M1
- Phase 2 — Core Backend
- Phase 3 — AI Foundation
- Phase 4 — Client Applications
- Phase 5 — Core Features
- Phase 6 — Advanced Intelligence
- Phase 7 — Hardware Integration
- Phase 8 — Community Features
- Phase 9 — Optimization
- Phase 10 — Production Release
- `ROBOT_INTERFACE.md`, which is currently missing and must not be invented without an approved specification task

---

# Known Blockers

- No known blocker prevents M0 completion.
- `ROBOT_INTERFACE.md` is missing, but it is deferred and is not a blocker for M0.

---

# M0 Validation Record

- Validation date: July 31, 2026
- Tested branch: `main`
- GitHub Actions workflow: `CI`
- Push run `30621872911`: Passed
- Manual run `30621886110`: Passed
- M1 — Platform Skeleton: Complete

---

# M1 — Platform Skeleton

## Objective

Create launchable, independently testable application and service skeletons without implementing product or domain behavior.

## Included Tasks

| Task | Status |
|---|---|
| Create every documented application directory | Complete |
| Create a launchable blank React Native mobile shell | Complete |
| Create every documented backend service skeleton | Complete |
| Add backend health endpoints and configuration loading | Complete |
| Add database connection configuration only | Complete |
| Add authentication and permission interfaces only | Complete |
| Create every documented AI subsystem directory | Complete |
| Add a placeholder FastAPI AI Orchestrator health service | Complete |
| Add memory and plugin placeholders only | Complete |
| Create every documented shared package skeleton | Complete |
| Create every documented infrastructure directory | Complete |
| Wire pnpm workspaces and Turborepo across the skeleton | Complete |
| Add Docker images and Compose services for runnable skeletons | Complete |
| Validate builds, formatting, linting, tests, startup, and environment loading | Complete |
| Obtain a successful GitHub-hosted CI run | Complete |

## Explicitly Out of Scope

- Product or domain business logic
- Authentication or authorization behavior
- Database schemas and migrations
- AI inference, orchestration behavior, model providers, embeddings, or learning
- Memory storage, retrieval, ranking, or deletion behavior
- Plugin discovery, loading, execution, marketplace, or sandbox behavior
- User-facing product screens or workflows
- Phase 2 domain-service APIs
- Kubernetes, Terraform, cloud deployment, and production infrastructure

## Completion Rule

M1 may be marked complete only after all skeleton processes build and start, local validation passes, Docker Compose boots the runnable skeleton, and GitHub-hosted CI passes. M2 remains untouched until separately approved.

## Validation Record

- Local validation date: July 31, 2026
- Tested branch: `main`
- Frozen dependency installation: Passed
- Turborepo build: Passed for all 29 TypeScript workspaces
- Formatting, linting, and type checking: Passed
- Jest, Pytest, React Native Jest, and Playwright: Passed
- Docker Compose: All 16 backend services, AI Orchestrator, mobile Metro, and development workspace started successfully
- Health verification: Every runnable M1 skeleton endpoint passed
- Environment loading and pinned container runtimes: Passed
- GitHub-hosted CI validation date: July 31, 2026
- GitHub-hosted CI workflow: `CI`
- GitHub-hosted CI push run `30625632508`: Passed
- GitHub-hosted CI tested branch: `main`
- M1 milestone status: Complete
- M2 — Core Backend: Not started

---

# Milestone Control Rule

Only tasks explicitly listed under the active milestone may be implemented.

If requested work is outside M0, conflicts with these constraints, or requires architecture or product decisions not already approved:

1. Do not implement it.
2. Record or report it as deferred or blocked, as appropriate.
3. Request explicit approval before changing the active milestone or expanding its scope.
