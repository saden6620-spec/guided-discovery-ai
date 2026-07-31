# Guided Discovery AI

Guided Discovery AI is a modular AI platform whose first planned application is an intelligent travel companion. The platform is designed to help people explore safely, learn through guided discovery, and become more capable without creating dependency.

This repository is currently limited to **Phase 0 — M0 Repository Foundation**. It contains development tooling and repository structure only. It does not contain application logic, backend services, APIs, authentication, databases, AI behavior, or user-facing features.

## Prerequisites

- Node.js 24.18.0 LTS (`>=24 <25`)
- pnpm 11.4.0, activated through Corepack
- Python 3.13.14 (`>=3.13,<3.14`)
- Docker Engine 29 with Docker Compose v2, or a compatible Docker Desktop release
- Git

## Setup

1. Install the prerequisite runtime versions.
2. Enable Corepack and activate the repository's pinned pnpm version.
3. Install JavaScript dependencies using the committed lockfile.
4. Create a Python virtual environment.
5. Install `pytest==9.1.1` and `ruff==0.15.22` into that environment.
6. Install the Playwright Chromium browser.
7. Run the complete validation suite.

The corresponding commands are:

```text
corepack enable
corepack prepare pnpm@11.4.0 --activate
pnpm install --frozen-lockfile
python -m venv .venv
python -m pip install pytest==9.1.1 ruff==0.15.22
pnpm exec playwright install chromium
pnpm validate
```

Activate the virtual environment before running Python commands. Activation is operating-system and shell specific.

## Repository Structure

```text
apps/            Future user-facing applications
backend/         Future backend services
ai/              Future AI runtime and independent engines
packages/        Future shared packages
infrastructure/  Future reproducible deployment infrastructure
docs/            Approved documentation destination
scripts/         Future cross-platform automation
assets/          Future static assets
tests/           Foundation and future project-wide tests
tools/           Future developer tooling
Documents/       Current authoritative project specifications
docker/          Development container image
```

The authoritative detailed layout is defined in `Documents/REPOSITORY_STRUCTURE.md`.

## Development Commands

| Command                | Purpose                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| `pnpm format`          | Format supported JavaScript, TypeScript, configuration, and Python files |
| `pnpm format:check`    | Verify formatting without changing files                                 |
| `pnpm lint`            | Run ESLint and Ruff                                                      |
| `pnpm typecheck`       | Run TypeScript checking                                                  |
| `pnpm test:javascript` | Run Jest foundation tests                                                |
| `pnpm test:python`     | Run Pytest foundation tests                                              |
| `pnpm test:e2e`        | Run Playwright foundation tests                                          |
| `pnpm validate`        | Run all local quality and test checks                                    |
| `pnpm docker:config`   | Validate Docker Compose                                                  |
| `pnpm docker:up`       | Build and start the development environment                              |
| `pnpm docker:down`     | Stop the development environment                                         |

## Dev Container

Open the repository in a Dev Container-compatible editor and select **Reopen in Container**. The container uses Node.js 24.18.0, pnpm 11.4.0, and Python 3.13.14.

## Documentation

Start with:

- `Documents/AGENTS.md`
- `Documents/TASKS.md`
- `Documents/SYSTEM_ARCHITECTURE.md`
- `Documents/REPOSITORY_STRUCTURE.md`
- `Documents/TECH_STACK.md`

Only the active milestone in `Documents/TASKS.md` may be implemented.

## Troubleshooting

- If pnpm reports an engine mismatch, verify that Node.js 24 is active.
- If Python tooling cannot run, verify that Python 3.13 is active and the virtual environment contains Pytest and Ruff.
- If Playwright cannot find Chromium, rerun `pnpm exec playwright install chromium`.
- On Windows, Docker Desktop with WSL2-backed storage is recommended for container performance.
- Run `docker compose config` to diagnose Compose configuration before starting the environment.
