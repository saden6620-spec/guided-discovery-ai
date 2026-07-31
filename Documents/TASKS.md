# TASKS.md

Version: 1.0

---

# Purpose

This document identifies the only milestone currently authorized for implementation.

Only the active milestone may be implemented. Work outside the active milestone must remain deferred until the milestone is changed through explicit approval.

---

# Current Status

- Active phase: Phase 0 — Development Environment
- Phase status: In progress
- Active milestone: M0 — Repository Foundation
- Milestone status: In progress
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
| Add initial GitHub Actions CI | In progress |
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

- Phase 1 — Platform Foundation
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

- A GitHub-hosted CI run has not been performed because this local repository is not connected to a GitHub remote. The workflow passed local syntax validation, and every configured job command passed locally.
- `ROBOT_INTERFACE.md` is missing, but it is deferred and is not a blocker for M0.

---

# Milestone Control Rule

Only tasks explicitly listed under the active milestone may be implemented.

If requested work is outside M0, conflicts with these constraints, or requires architecture or product decisions not already approved:

1. Do not implement it.
2. Record or report it as deferred or blocked, as appropriate.
3. Request explicit approval before changing the active milestone or expanding its scope.
