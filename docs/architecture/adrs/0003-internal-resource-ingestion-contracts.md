# ADR-0003: Internal Resource-Ingestion Contracts

- Status: Accepted
- Date: 2026-08-01
- Decision scope: Creation of M2 resources without public create endpoints

## Context and problem

Several documented public APIs read or mutate resources whose creation path is absent:

- Memory creation requires a category, but category creation or seeding is undefined.
- Navigation start requires destinations and routes, but their provisioning is undefined.
- Recommendation exposes list/accept/dismiss without a recommendation-ingestion contract.
- Notification exposes list/update/delete without a notification-scheduling contract.
- Search requires source documents without an approved indexing-ingestion contract.

Adding public endpoints would expand `API_SPEC.md`. Relying on database seeds or direct writes would violate service ownership and API-first architecture.

## Why it matters

- The M2 exit criterion requires functional backend APIs.
- Hidden database writes bypass validation, authorization, events, and auditability.
- Future AI or provider components need stable contracts without owning domain data.
- Publicly exposing producer operations could create unauthorized product functionality.

## Decision drivers

- Do not add undocumented public endpoints.
- Preserve single ownership and API/event communication.
- Keep M3 AI generation outside M2.
- Make M2 services testable with deterministic, non-AI producers.
- Distinguish public user APIs from internal service commands.

## Options considered

### Option A: Add public CRUD endpoints for every underlying entity

Advantages:

- Straightforward testing and manual use.

Disadvantages:

- Expands the documented public API without product authorization.
- Exposes internal resources such as scores, routes, and delivery jobs.
- Couples clients to implementation details.

### Option B: Seed or write resources directly in each database

Advantages:

- Minimal API work.

Disadvantages:

- Bypasses service ownership and validation.
- Is not a functional production contract.
- Produces unaudited and non-evented state.

### Option C: Private service commands plus versioned ingestion events

Each owning service exposes an authenticated internal command contract only where an immediate response is required. Event-fed read models use versioned ingestion events. M2 tests use deterministic internal producers; AI and external integrations remain absent.

Advantages:

- Preserves public API exactly as documented.
- Maintains service ownership and validation.
- Supports future AI/provider producers without embedding their logic.
- Provides testable functional services.

Disadvantages:

- Requires separate internal API/event documentation.
- Requires service identity and authorization.
- Adds contracts not currently specified.

## Recommended decision

Adopt **Option C** with the smallest per-service contracts:

These private ingestion commands remain **unapproved technical contracts** until their exact DTOs, service authentication, authorization rules, and permitted producer identities are separately specified and approved. This ADR proposes ownership and transport boundaries; it does not authorize implementation or producer access.

### Memory categories

- Initial migrations create a documented, explicitly approved minimal system-category catalog.
- Category IDs are stable.
- No M2 public category-management API is added.
- User-defined categories remain deferred unless separately specified.

### Navigation

- Navigation Service owns private commands to register/update provider-neutral destinations and routes.
- Commands accept already computed data and do not generate routes.
- Route and destination producers authenticate as services and receive only the minimum required permissions.

### Recommendation

- Recommendation Service owns an internal `CreateRecommendation` command.
- The command accepts a completed recommendation, rationale metadata, score inputs, availability, and provenance; it performs no generation or ranking.
- M3 may call this command after generating a recommendation.

### Notification

- Notification Service owns an internal `ScheduleNotification` command.
- It accepts completed content, channel, recipient reference, schedule, provenance, and idempotency key.
- It performs no AI reminder generation.
- External provider delivery remains a separate adapter decision.

### Search

- Search ingests versioned `SearchDocumentUpserted` and `SearchDocumentDeleted` events from owning services.
- Search never fetches source records by direct database access.
- Events include approved access-projection and deletion-version fields established by ADR-0001 and ADR-0002.

All internal commands use service authentication, request validation, idempotency, audit logging, and the common error envelope. They are not routed through the public client API surface unless later documented.

## Consequences

### Positive

- Public API remains unchanged.
- Every exposed M2 resource has a legitimate creation path.
- M2 remains free of AI generation and external provider behavior.
- Future producers integrate through stable contracts.

### Negative

- Internal API documentation and service identity are required.
- Additional integration and contract tests are necessary.
- Producer authorization must be administered by Permission/Auth infrastructure.

### Required follow-up specifications

- Internal base URL or transport convention.
- Service authentication mechanism.
- Command DTOs and error responses.
- Provenance fields.
- Initial memory category catalog.
- Provider-neutral route representation.
- Recommendation rationale and score schema.
- Notification recipient-reference and delivery boundary.

## Affected services

- Memory Service
- Navigation Service
- Recommendation Service
- Notification Service
- Search Service
- Permission Service
- Authentication Service
- Future AI Orchestrator and provider adapters

## Affected documents

- `docs/api/m2/memory-service.md`
- `docs/api/m2/navigation-service.md`
- `docs/api/m2/recommendation-service.md`
- `docs/api/m2/notification-service.md`
- `docs/api/m2/search-service.md`
- `docs/api/m2/common-contracts.md`
- `docs/api/m2/openapi.yaml`
- `API_SPEC.md`
- `SERVICE_ARCHITECTURE.md`
- `SYSTEM_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `AI_PIPELINE.md`
- `PRODUCT_SPEC.md`
- `MEMORY_ARCHITECTURE.md`
