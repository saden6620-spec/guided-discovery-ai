# TASKS.md

Version: 1.0

---

# Purpose

This document identifies the only milestone currently authorized for implementation.

Only the active milestone may be implemented. Work outside the active milestone must remain deferred until the milestone is changed through explicit approval.

---

# Current Status

- Active phase: Phase 2 — Core Backend
- Phase status: In progress
- Active milestone: M2.5 — Recommendation Service
- Milestone status: In progress — local validation complete, hosted CI pending
- Hosted CI validation: Pending
- Hosted CI tested branch: `main`
- Next milestone: M2.6 — Documentation Service
- Next milestone status: Not started
- Last reviewed: 2026-08-02

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

# M2.1 — Shared Backend Foundation

## Objective

Implement only reusable backend infrastructure shared by backend services. Domain services and product behavior remain deferred.

## Included Tasks

| Task | Status |
| --- | --- |
| Shared configuration package | Complete |
| Shared types package | Complete |
| Shared error framework | Complete |
| Shared validation framework | Complete |
| Shared logging framework | Complete |
| Shared telemetry framework | Complete |
| Shared health framework | Complete |
| Shared database abstractions | Complete |
| Shared event abstractions | Complete |
| Shared testing utilities | Complete |
| Package documentation and exports | Complete |
| Complete local validation | Complete |
| GitHub-hosted CI validation | Complete |

## Explicitly Out of Scope

- Memory, Planning, Navigation, Recommendation, Documentation, Notification, and Search Service implementation
- AI orchestration or AI behavior
- Authentication business logic
- PostgreSQL entities or domain migrations
- Event broker implementation
- External telemetry providers
- Client applications or user-facing product behavior
- M2.2 and later milestones

## Completion Rule

M2.1 is complete only when every shared package is documented, strictly typed, exported, unit tested, and all formatting, lint, type checking, Jest, Turborepo, Docker, local CI-equivalent, and GitHub-hosted CI checks pass. M2.2 remains not started until separately approved.

## Validation Record

- Local validation date: August 1, 2026
- Tested branch: `main`
- Frozen dependency installation: Passed
- Turborepo build: Passed for all 34 TypeScript workspaces
- Formatting, ESLint, Ruff, and type checking: Passed
- Jest: 67 tests passed across 11 suites
- Pytest: 2 tests passed
- Workspace tests and Playwright: Passed
- Docker Compose configuration: Passed
- Docker Compose startup: All M1 skeleton containers became healthy
- Skeleton health and environment verification: Passed
- Container runtimes: Node.js 24.18.0, pnpm 11.4.0, Python 3.13.14
- GitHub-hosted CI workflow: `CI`
- GitHub-hosted CI run `30674524410`: Passed
- GitHub-hosted CI tested branch: `main`
- M2.1 milestone status: Complete
- M2.2 — Memory Service: Not started

---

# M2.2 — Memory Service

## Objective

Implement the approved Memory Service HTTP, persistence, lifecycle, deletion, reliability, and operational contracts without implementing AI retrieval, embeddings, Search, recommendations, or another domain service.

## Included Tasks

| Task | Status |
| --- | --- |
| Correct approved Memory Service specification contradictions | Complete |
| NestJS module organization and configuration | Complete |
| Public Memory API and internal category API | Complete |
| Memory entities, repository, and Prisma migrations | Complete |
| Validation, authorization boundary, concurrency, and idempotency | Complete |
| Immutable versions and stable links | Complete |
| Immediate deletion ledger and purge metadata | Complete |
| Transactional outbox and inbox abstractions | Complete |
| Health, readiness, logging, and telemetry integration | Complete |
| OpenAPI generation and contract validation | Complete |
| Unit, integration, API contract, and migration tests | Complete |
| Complete local and Docker validation | Complete |
| GitHub-hosted CI validation | Complete |

## Scope Control

M2.3 and later work remains not started. M2.2 excludes all non-memory domain services, AI behavior, embeddings, vector or semantic retrieval, Search indexing implementation, personalization, recommendations, and client behavior.

## Validation Record

- Local validation date: August 1, 2026
- Tested branch: `main`
- Frozen pnpm installation and dependency resolution: Passed
- Approved public OpenAPI structural validation: Passed; seven non-blocking pre-existing tag-description warnings
- Prisma schema validation and forward migration: Passed
- Migration reversal and clean reapplication: Passed against an isolated PostgreSQL database
- Memory Service Jest suites: 6 tests passed across 5 suites
- Repository Jest suites: 73 tests passed across 16 suites
- Pytest: 2 tests passed
- Formatting, ESLint, Ruff, TypeScript, Playwright, Turborepo test, and Turborepo build: Passed
- Docker Compose configuration and complete skeleton startup: Passed
- Memory Service liveness and readiness: Passed; PostgreSQL and schema checks reported `UP`
- Container migration and startup: Passed without Prisma runtime warnings after installing OpenSSL
- GitHub-hosted CI validation date: August 1, 2026
- GitHub-hosted CI workflow: `CI`
- GitHub-hosted CI run `30695266345`: Passed
- GitHub-hosted CI tested branch: `main`
- M2.2 milestone status: Complete
- M2.3 — Planning Service: In progress

---

# M2.3 — Planning Service

## Objective

Implement the approved Planning Service HTTP, persistence, lifecycle, child-mutation, reliability, and operational contracts without implementing plan generation, Navigation, recommendations, providers, AI behavior, or another domain service.

## Included Tasks

| Task | Status |
| --- | --- |
| Correct the four approved Planning specification contradictions | Complete |
| NestJS module organization and configuration | Complete |
| Public Planning API | Complete |
| Itinerary aggregate entities, repository, and Prisma migrations | Complete |
| Stable-ID itinerary item, reservation, and checklist operations | Complete |
| Validation, authorization boundary, concurrency, and idempotency | Complete |
| Planning lifecycle transitions and immediate logical deletion | Complete |
| Transactional outbox and inbox/dead-letter abstractions | Complete |
| Health, readiness, logging, metrics, and tracing integration | Complete |
| OpenAPI generation and contract validation | Complete |
| Unit, integration, API contract, and migration tests | Complete |
| Complete local, migration, and Docker validation | Complete |
| GitHub-hosted CI validation | Complete |

## Scope Control

M2.4 and later work remains not started. M2.3 excludes plan generation, Navigation Service behavior, providers, recommendations, AI behavior, authentication business logic, Search, embeddings, personalization, and client features.

## Validation Record

- Local validation date: August 1, 2026
- Tested branch: `main`
- Frozen pnpm installation and dependency resolution: Passed
- Approved OpenAPI Planning contract generation and structural validation: Passed
- Prisma schema validation and forward migration: Passed
- Migration clean apply, reversal, and reapplication: Passed against an isolated PostgreSQL database
- Planning Service Jest suites: 7 tests passed across 5 suites
- Repository Jest suites: 80 tests passed across 21 suites
- Pytest: Passed
- Formatting, ESLint, Ruff, strict TypeScript, Playwright, Turborepo tests, and Turborepo build: Passed
- Docker Compose configuration, image build, and complete skeleton startup: Passed after excluding ignored dependency artifacts from the build context
- Planning Service liveness and readiness: Passed; PostgreSQL reported `UP`
- Container runtimes: Node.js 24.18.0, pnpm 11.4.0, Python 3.13.14
- GitHub-hosted CI validation date: August 1, 2026
- GitHub-hosted CI workflow: `CI`
- GitHub-hosted CI run `30702819899`: Passed
- GitHub-hosted CI tested branch: `main`
- M2.3 milestone status: Complete
- M2.4 — Navigation Service: In progress

---

# M2.4 — Navigation Service

## Objective

Implement the approved provider-neutral Navigation Service HTTP, private provisioning, persistence, lifecycle, reliability, privacy, and operational contracts without implementing route generation, external map providers, live GPS, AI navigation, client maps, Recommendation Service, or another later milestone.

## Included Tasks

| Task | Status |
| --- | --- |
| Reconcile M2.4 implementation instructions with approved ADR-0007 lifecycle | Complete |
| NestJS module organization and configuration | Complete |
| Public start, stop, status, and reroute API | Complete |
| Private destination and route provisioning API | Complete |
| Navigation-owned entities, constraints, indexes, and Prisma migration | Complete |
| Atomic Trip and first Navigation Session creation | Complete |
| ACTIVE, COMPLETED, and CANCELLED lifecycle enforcement | Complete |
| Authorization boundary, validation, optimistic concurrency, and idempotency | Complete |
| Encrypted route geometry and coordinate privacy controls | Complete |
| Transactional outbox, inbox, and dead-letter foundations | Complete |
| Approved Trip and Navigation events | Complete |
| Health, readiness, version, logging, metrics, and tracing integration | Complete |
| OpenAPI generation and public/internal contract validation | Complete |
| Unit, integration, API, lifecycle, privacy, event, and migration tests | Complete |
| Complete repository, migration, Playwright, and Docker validation | Complete |
| GitHub-hosted CI validation | Complete |

## Scope Control

M2.5 and later work remains not started. M2.4 excludes Recommendation Service behavior, external map providers, route generation, live GPS, traffic, weather, ETA intelligence, safety-engine decisions, AI navigation, client map screens, robot navigation, community sharing, pause, resume, session replacement, navigation-only sessions, and undocumented provisioning endpoints.

## Validation Record

- Local validation date: August 1, 2026
- Tested branch: `main`
- Frozen pnpm installation and dependency resolution: Passed
- Approved public OpenAPI, internal OpenAPI, AsyncAPI, and lifecycle contract validation: Passed
- Prisma schema validation and forward migration: Passed
- Migration clean apply, lossless reversal, and reapplication: Passed against the independently owned Navigation PostgreSQL database
- Navigation Service Jest suites: 7 tests passed across 5 suites
- Repository Jest suites: 87 tests passed across 26 suites, including Memory and Planning regressions
- Pytest: Passed
- Formatting, ESLint, Ruff, strict TypeScript, Turborepo tests, and 34-workspace Turborepo build: Passed
- Playwright: Passed after installing its documented Chromium system dependencies
- Docker Compose configuration, image build, and complete skeleton startup: Passed
- Memory, Planning, and Navigation readiness: Passed; each service reported PostgreSQL `UP`
- Container runtimes: Node.js 24.18.0, pnpm 11.4.0, Python 3.13.14
- GitHub-hosted CI validation date: August 1, 2026
- GitHub-hosted CI workflow: `CI`
- GitHub-hosted CI run `30707288568`: Passed
- GitHub-hosted CI tested branch: `main`
- M2.4 milestone status: Complete
- M2.5 — Recommendation Service: In progress

---

# M2.5 — Recommendation Service

## Objective

Implement the approved Recommendation Service ingestion, persistence, disposition lifecycle, reliability, privacy, and operational contracts without implementing recommendation generation, AI, personalization, ranking logic, external providers, client interfaces, Documentation Service, or another later milestone.

## Included Tasks

| Task | Status |
| --- | --- |
| Resolve approved permission-policy persistence and scalar score specifications | Complete |
| NestJS module organization and configuration | Complete |
| Public list, accept, and dismiss API | Complete |
| Private authenticated recommendation-ingestion API | Complete |
| Recommendation-owned entities, constraints, indexes, and Prisma migration | Complete |
| AVAILABLE, ACCEPTED, DISMISSED, and EXPIRED M2.5 lifecycle enforcement | Complete |
| Canonical deferred REJECTED and IGNORED storage vocabulary | Complete |
| Permission Service validation, producer authorization, and fail-closed boundaries | Complete |
| Encrypted content, immutable provenance, and privacy-safe logging | Complete |
| Optimistic concurrency, idempotency, append-only history, and expiration handling | Complete |
| Transactional outbox, inbox, and dead-letter foundations | Complete |
| Approved RecommendationAccepted, RecommendationDismissed, and RecommendationExpired events | Complete |
| Health, readiness, version, request IDs, tracing, rate-limit headers, and metrics hooks | Complete |
| OpenAPI generation and public/internal/AsyncAPI contract validation | Complete |
| Unit, integration, API, lifecycle, privacy, authorization, event, and migration tests | Complete |
| Complete repository, migration, Playwright, and Docker validation | Complete |
| GitHub-hosted CI validation | Pending |

## Scope Control

M2.6 and later work remains not started. M2.5 excludes AI or LLM recommendation generation, personalized ranking, memory retrieval, planning or navigation behavior, external providers, booking, payment, automatic execution, client recommendation screens, community recommendations, structured safety/accessibility attributes, an external event broker adapter, Documentation Service behavior, and all later milestones.

## Validation Record

- Local validation date: August 2, 2026
- Tested branch: `main`
- Frozen pnpm installation and dependency resolution: Passed
- Corrected internal OpenAPI and AsyncAPI parsing and Recommendation contract review: Passed
- Prisma schema validation and forward migration: Passed
- Migration clean apply, reviewed reversal, migration-record cleanup, and clean reapplication: Passed against the independently owned Recommendation PostgreSQL database
- Recommendation Service Jest suites: 6 tests passed across 5 suites
- Repository Jest suites: 93 tests passed across 31 suites, including Memory, Planning, and Navigation regressions
- Pytest: Passed
- Formatting, ESLint, Ruff, strict TypeScript, Turborepo tests, and 34-workspace Turborepo build: Passed
- Playwright: Passed
- Docker Compose configuration, current-workspace image build, and complete skeleton startup: Passed
- Recommendation readiness: Passed with PostgreSQL `UP`
- Complete skeleton health verification: Passed
- Container runtimes: Node.js 24.18.0, pnpm 11.4.0, Python 3.13.14
- Normal clean Docker rebuild attempts were interrupted by external registry transport failures; the exact current lockfile and all 34 workspaces were then rebuilt successfully using the previously validated M2.4 image as an offline dependency cache
- GitHub-hosted CI validation: Pending
- M2.5 milestone status: In progress pending hosted CI
- M2.6 — Documentation Service: Not started

---

# Milestone Control Rule

Only tasks explicitly listed under the active milestone may be implemented.

If requested work is outside M0, conflicts with these constraints, or requires architecture or product decisions not already approved:

1. Do not implement it.
2. Record or report it as deferred or blocked, as appropriate.
3. Request explicit approval before changing the active milestone or expanding its scope.
