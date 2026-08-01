# ADR-0001: Authoritative Permission Checks and Protected-Data Projections

- Status: Accepted
- Date: 2026-08-01
- Decision scope: M2 protected domain data and Search

## Context and problem

The Permission Service owns permission lookup, permission updates, privacy enforcement, consent tracking, and authorization of protected-data access. Every service must consult it before accessing protected user data.

The draft Memory contract accepts a client-provided `permissionScope`, and the Search contract proposes indexes containing `ownerId` but no authoritative permission, visibility, consent-version, sensitivity, or revocation information. This leaves unclear whether domain services are making permission decisions themselves and how Search can safely filter indexed results.

## Why it matters

- Client-selected permission scopes can become a privilege-escalation path.
- Duplicating authoritative permission state across domain databases creates inconsistent decisions.
- Search may disclose indexed data after permission revocation.
- Permission Service failure behavior is undefined.
- The architecture requires privacy validation before data access and prohibits bypassing the Permission Service.

## Decision drivers

- Permission Service remains the sole authorization authority.
- Services continue to own their domain data.
- Search remains responsible for its index without becoming a permission authority.
- Revocation must take effect immediately for normal application behavior.
- Services must fail closed when protected-data authorization cannot be established.
- No service may read the Permission Service database directly.

## Options considered

### Option A: Client-selected scope stored and enforced by each domain service

Each domain service accepts a permission scope and decides whether it is valid.

Advantages:

- Few service calls.
- Simple local queries.

Disadvantages:

- Violates the Permission Service ownership boundary.
- Replicates policy logic.
- Allows policy drift and possible privilege escalation.
- Makes consent-history enforcement inconsistent.

### Option B: Synchronous Permission Service check on every protected read and write

Each service sends subject, actor, action, resource type, resource ID, and requested purpose to Permission Service for every operation.

Advantages:

- Strongly centralized decisions.
- Revocations are immediately authoritative.
- Policy logic is not duplicated.

Disadvantages:

- Permission Service becomes a latency and availability dependency.
- Bulk Search results could cause an unsafe or expensive per-result call pattern.
- Requires careful timeout and failure-deny behavior.

### Option C: Authoritative synchronous checks plus non-authoritative access projections

Writes and sensitive single-resource reads receive an authoritative decision from Permission Service. Domain records store only a permission-reference/policy key. Permission Service publishes versioned `PermissionChanged` events. Search and other read models maintain minimal, non-authoritative access projections for candidate filtering, followed by an authoritative batch decision before returning protected results.

Advantages:

- Preserves Permission Service authority.
- Supports efficient Search filtering.
- Handles revocation through both projection invalidation and final authorization.
- Avoids direct database access and policy duplication.
- Supports fault isolation with fail-closed behavior.

Disadvantages:

- Adds a projection and event-consistency mechanism.
- Requires a batch authorization API.
- Requires deletion/revocation barriers to prevent stale projection exposure.

## Recommended decision

Adopt **Option C**.

This is the smallest solution that simultaneously preserves Permission Service ownership and allows Search to function at scale:

1. End-user DTOs must not accept an authoritative permission scope.
2. Domain services obtain an authorization decision from Permission Service for protected operations.
3. Domain entities store only a stable `permissionPolicyRef` and the last evaluated `permissionVersion`; neither grants access by itself.
4. Permission Service exposes a service-to-service batch authorization contract for Search.
5. `PermissionChanged` invalidates affected projections and caches.
6. Search indexes may store only the minimum access-filter fields: owner ID, visibility classification, policy reference, permission version, and deletion state.
7. Before returning protected Search results, Search performs a batch authoritative check. If Permission Service is unavailable or times out, protected results are withheld and the request fails closed.
8. Public or explicitly shared resources still require a policy decision establishing that visibility.

The exact permission rules remain owned by Permission Service and are not defined by this ADR.

## Consequences

### Positive

- One authoritative policy engine.
- Immediate revocation can be enforced.
- Domain ownership remains intact.
- Search can filter efficiently without owning policy.
- Permission decisions remain auditable.

### Negative

- Protected reads depend on Permission Service availability.
- Search requires a batch-check contract and access projection.
- Event and cache invalidation paths require integration tests.
- Latency budgets and timeouts must be specified.

### Required follow-up specifications

- Permission-check request and response DTOs.
- Batch authorization limits and timeout behavior.
- `PermissionChanged` payload and ordering key.
- Permission-policy reference format.
- Visibility and sensitivity enumerations.
- Audit-event requirements.

## Affected services

- Permission Service
- Memory Service
- Documentation Service
- Navigation Service where precise location is protected
- Planning Service where plans or reservations are protected
- Recommendation Service
- Notification Service
- Search Service
- API Gateway

## Affected documents

- `docs/api/m2/common-contracts.md`
- `docs/api/m2/memory-service.md`
- `docs/api/m2/planning-service.md`
- `docs/api/m2/navigation-service.md`
- `docs/api/m2/recommendation-service.md`
- `docs/api/m2/documentation-service.md`
- `docs/api/m2/notification-service.md`
- `docs/api/m2/search-service.md`
- `docs/api/m2/openapi.yaml`
- `SERVICE_ARCHITECTURE.md`
- `SYSTEM_ARCHITECTURE.md`
- `API_SPEC.md`
- `DATABASE_SCHEMA.md`
- `MEMORY_ARCHITECTURE.md`
- `AI_PIPELINE.md`
- `PRODUCT_SPEC.md`
