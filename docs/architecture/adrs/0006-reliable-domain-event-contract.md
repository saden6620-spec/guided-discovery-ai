# ADR-0006: Reliable Domain-Event Contract

- Status: Accepted
- Date: 2026-08-01
- Decision scope: M2 service-to-service events

## Context and problem

The architecture is event-driven and names events such as `MemorySaved`, `TripStarted`, `TripCompleted`, `RecommendationAccepted`, `RecommendationRejected`, and `PermissionChanged`. The draft M2 event envelope defines identity and correlation fields but not transport ownership, ordering, delivery guarantees, deduplication, atomic publication, compatibility, retention, or sensitive-data rules.

Event names are also inconsistent across documents and drafts, including `MemoryCreated` versus `MemorySaved`, and `RecommendationRejected` versus API `dismiss` terminology.

## Why it matters

- Database state can commit without its event being published.
- Duplicate delivery can repeat destructive or state-changing work.
- Out-of-order events can resurrect deleted or older data.
- Consumers cannot evolve safely without compatibility rules.
- Sensitive content may spread through the bus without purpose limitation.
- Distributed deletion and Search indexing depend on reliable events.

## Decision drivers

- Loose coupling and independent ownership.
- At-least-once transport tolerance.
- Atomic relationship between state changes and publication.
- Idempotent consumers.
- Per-resource ordering.
- Minimal event payloads.
- Backward-compatible evolution.
- Clear event vocabulary.

## Options considered

### Option A: Best-effort publish after database commit

Advantages:

- Minimal infrastructure.
- Easy producer code.

Disadvantages:

- Events can be permanently lost.
- Cannot support reliable indexing or deletion.
- Recovery requires database inspection or manual repair.

### Option B: Distributed transaction across database and broker

Advantages:

- Strong atomicity where supported.

Disadvantages:

- Tight infrastructure coupling.
- Operational complexity and reduced availability.
- Poor portability and scalability.

### Option C: Transactional outbox with at-least-once delivery and idempotent inboxes

Producers write domain state and an outbox record in one local transaction. A publisher sends events at least once. Each consumer maintains an inbox/deduplication record and applies its state change transactionally. Events partition by subject/aggregate ID.

Advantages:

- No distributed transaction.
- Reliable recovery after failures.
- Compatible with database-per-service ownership.
- Supports ordering and deduplication.

Disadvantages:

- Adds outbox/inbox tables and workers.
- Delivery is not exactly once; consumers must be idempotent.
- Requires retention and replay policies.

## Recommended decision

Adopt **Option C**.

### Canonical event envelope

Every event contains:

- `eventId`: globally unique immutable ID.
- `eventType`: canonical past-tense name.
- `eventVersion`: positive schema version.
- `occurredAt`: producer-recorded UTC timestamp.
- `producer`: owning service name.
- `subjectType` and `subjectId`: aggregate identity and ordering key.
- `actorId`: user or service principal when applicable.
- `ownerId`: data owner when different from actor; omitted when unnecessary.
- `correlationId`: request or workflow correlation.
- `causationId`: triggering command or event ID when applicable.
- `permissionVersion`: required when protected data or access projection is involved.
- `deletionVersion`: required for deletion-related events.
- `payload`: minimal event-specific data.

Do not duplicate `occurredAt` inside payloads. Sensitive content is prohibited unless a documented subscriber cannot perform its responsibility without it and permission explicitly allows the purpose.

### Delivery semantics

1. Producer state and outbox event commit atomically.
2. Delivery is at least once.
3. Events are partitioned and ordered by `subjectId` within an event family.
4. Consumers deduplicate by `eventId` in a transactional inbox.
5. Consumers reject or quarantine unsupported major event versions.
6. Additive optional fields are backward-compatible; removals, meaning changes, and required-field additions require a new event version.
7. Failed events use bounded retries followed by a dead-letter path and operational alert.
8. Replay cannot bypass current permission or deletion barriers.
9. Event and outbox retention durations require explicit operational approval.

### Canonical vocabulary

- Use `MemorySaved` for creation or update because it is named by `SERVICE_ARCHITECTURE.md`; payload contains `operation: CREATED | UPDATED`.
- Use `MemoryDeletionRequired` and `MemoryPurged` for the deletion lifecycle established by ADR-0002.
- Use `TripStarted` only when a non-null trip exists and starts.
- Use `TripCompleted` only when a trip reaches completed state, not for every navigation stop.
- Recommendation lifecycle and disposition semantics, including the distinction among accepted, rejected, dismissed, ignored, and expired, are governed by ADR-0007. This ADR governs only the reliability and envelope of the resulting canonical events.
- Use `PermissionChanged` for permission projection invalidation.

### Transport neutrality

This ADR defines semantics, not a broker product. The implementation may use the approved event bus/queue foundation as long as these guarantees are met. Event schemas should be documented in an AsyncAPI or equivalent machine-readable contract; OpenAPI remains for HTTP.

Operational retention values for outbox, inbox/deduplication, dead-letter, and event-related records are governed by ADR-0008. This ADR does not independently select those durations.

## Consequences

### Positive

- Reliable Search indexing and distributed deletion.
- Recoverable publication failures.
- Safe duplicate handling.
- Predictable schema evolution.
- Clear event ownership and vocabulary.

### Negative

- Every producer needs an outbox publisher.
- Every consumer needs inbox/deduplication behavior.
- Monitoring, dead-letter handling, and replay tooling are required.
- Event latency remains eventual rather than synchronous.

### Required follow-up specifications

- AsyncAPI event catalog.
- Event-specific payload schemas.
- Topic/stream naming.
- Retry and dead-letter policy.
- Outbox/inbox retention.
- Maximum event size.
- Sensitive-data classification and encryption.
- Broker selection or adapter contract.

## Affected services

- All seven M2 domain services
- Permission Service
- API Gateway where correlation begins
- Analytics Service
- AI Orchestrator and later AI consumers
- Any future event subscriber

## Affected documents

- `docs/api/m2/common-contracts.md`
- Every service specification under `docs/api/m2/`
- Future M2 AsyncAPI document
- `SERVICE_ARCHITECTURE.md`
- `SYSTEM_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `MEMORY_ARCHITECTURE.md`
- `API_SPEC.md`
- `AI_PIPELINE.md`
- `PRODUCT_SPEC.md`
