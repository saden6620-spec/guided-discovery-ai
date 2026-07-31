# REPOSITORY_STRUCTURE.md
Version: 1.0

---

# Purpose

This document defines the directory structure for the Guided Discovery AI project.

The repository is organized as a modular monorepo.

Every application, backend service, shared library, AI component, infrastructure asset, and documentation file has a dedicated location.

The structure should remain scalable as the project grows.

---

# Repository Principles

The repository follows these principles:

- Separation of concerns.
- Independent modules.
- Shared libraries.
- Reusable components.
- Clear ownership.
- Minimal coupling.
- Easy navigation.

Every folder should have a single responsibility.

---

# High-Level Repository Structure

```
guided-discovery-ai/

├── apps/
├── backend/
├── ai/
├── packages/
├── infrastructure/
├── docs/
├── scripts/
├── assets/
├── tests/
├── tools/
├── .github/
├── .devcontainer/
├── docker/
├── .env.example
├── docker-compose.yml
├── package.json
├── README.md
└── LICENSE
```

---

# apps/

Contains every user-facing application.

```
apps/

├── mobile/
├── web/
├── desktop/
├── smartwatch/
├── smart-glasses/
├── robot/
└── admin-dashboard/
```

Each application should remain independently deployable.

---

# backend/

Contains backend services.

```
backend/

├── api-gateway/
├── auth-service/
├── user-service/
├── permission-service/
├── memory-service/
├── navigation-service/
├── recommendation-service/
├── learning-service/
├── documentation-service/
├── translation-service/
├── community-service/
├── notification-service/
├── media-service/
├── analytics-service/
└── search-service/
```

Each service owns its own business logic.

The Permission Service owns permissions, consent history, privacy settings, and authorization of protected data access.

---

# ai/

Contains AI-specific systems.

```
ai/

├── orchestrator/
├── conversation/
├── planning/
├── reasoning/
├── memory/
├── recommendation/
├── navigation/
├── vision/
├── speech/
├── translation/
├── safety/
├── accessibility/
├── personalization/
├── learning/
├── documentation/
└── evaluation/
```

Every AI subsystem should remain isolated.

---

# packages/

Shared code.

```
packages/

├── ui/
├── design-system/
├── shared-types/
├── shared-config/
├── utilities/
├── logging/
├── permissions/
├── authentication/
├── localization/
├── maps/
├── telemetry/
└── testing/
```

Packages should contain no application-specific logic.

---

# infrastructure/

Infrastructure definitions.

```
infrastructure/

├── terraform/
├── kubernetes/
├── docker/
├── monitoring/
├── networking/
├── secrets/
├── databases/
├── backups/
└── cloud/
```

Infrastructure should be reproducible.

---

# docs/

Project documentation.

```
docs/

├── product/
├── engineering/
├── architecture/
├── api/
├── database/
├── deployment/
├── onboarding/
├── decisions/
└── meeting-notes/
```

The product specifications belong under `docs/product/`.

Engineering documents belong under `docs/engineering/`.

---

# scripts/

Automation scripts.

Examples:

Database setup.

Development startup.

Deployment.

Data migration.

Testing.

Cleanup.

---

# assets/

Static resources.

Examples:

Images.

Icons.

Logos.

Videos.

Fonts.

Sounds.

Example datasets.

---

# tests/

Project-wide tests.

```
tests/

├── unit/
├── integration/
├── end-to-end/
├── performance/
├── accessibility/
├── security/
└── load/
```

Individual services may also contain local tests.

---

# tools/

Developer tooling.

Examples:

Code generators.

Documentation generators.

Migration tools.

Development utilities.

Benchmark tools.

---

# .github/

GitHub configuration.

```
.github/

├── workflows/
├── ISSUE_TEMPLATE/
├── PULL_REQUEST_TEMPLATE.md
├── CODEOWNERS
└── dependabot.yml
```

---

# docker/

Docker resources.

Examples:

Development containers.

Production containers.

Testing containers.

Shared images.

---

# Root Files

Examples:

README.md

LICENSE

package.json

docker-compose.yml

.env.example

.editorconfig

.gitignore

.prettierrc

.eslintrc

---

# Documentation Organization

Product specifications:

```
docs/product/
```

Engineering specifications:

```
docs/engineering/
```

Architecture:

```
docs/architecture/
```

API documentation:

```
docs/api/
```

Deployment:

```
docs/deployment/
```

Database documentation:

```
docs/database/
```

Decision records:

```
docs/decisions/
```

---

# Ownership

Every top-level directory should have a clearly defined owner.

Examples:

AI Team.

Backend Team.

Frontend Team.

Infrastructure Team.

Documentation Team.

Ownership improves long-term maintainability.

---

# Naming Conventions

Folders:

kebab-case

Examples:

memory-service

navigation-engine

api-gateway

Files:

Descriptive names.

Examples:

conversation_manager.ts

memory_store.py

navigation_controller.ts

---

# Growth Strategy

The repository should comfortably support:

Multiple mobile applications.

Multiple AI models.

Enterprise deployments.

Open-source components.

Robotics integration.

Cloud-native infrastructure.

Additional services.

The repository should never require restructuring simply because the project grows.

---

# Success Indicators

The repository succeeds when:

Developers easily locate code.

Subsystems remain isolated.

Shared code is reusable.

Documentation is organized.

Scaling the project does not require major restructuring.

---

# Acceptance Criteria

The repository structure is correctly implemented when:

✓ Every subsystem has a dedicated location.

✓ Shared code is separated from applications.

✓ Infrastructure remains isolated.

✓ Documentation is well organized.

✓ Testing is consistently structured.

✓ Future expansion does not require major reorganization.

✓ New contributors can quickly understand the project layout.
