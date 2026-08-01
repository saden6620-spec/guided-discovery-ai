# ADR-0002: Immediate Distributed Deletion Barrier

- Status: Accepted
- Date: 2026-08-01
- Decision scope: Memory deletion and every derived representation

## Context and problem

Memory deletion must take effect immediately from the user's perspective. A deleted memory must not be visible, searchable, available to AI, usable for recommendations or personalization, or present in analytics and normal application behavior. Temporary soft retention is permitted only for synchronization, distributed deletion, rollback-safe processing, or legal retention, followed by permanent deletion of every primary and derived record.

The draft contracts rely on asynchronous `MemoryDeleted` or indexing events. An event may be delayed, duplicated, or temporarily unavailable, leaving stale Search indexes, caches, projections, or downstream read models visible after the Memory Service has accepted deletion.

## Why it matters

- Asynchronous cleanup alone violates the immediate user-visible deletion guarantee.
- Database and event publication can diverge without atomic publication.
- Search and caches can return stale memory content.
- Downstream AI or recommendation systems could consume a memory during the cleanup window.
- Legal retention must not accidentally restore normal visibility.

## Decision drivers

- Immediate exclusion from all normal behavior.
- Event-driven distributed physical cleanup.
- Database-per-service ownership.
- No cross-service database access.
- Reliable recovery from retries, duplicates, and partial failures.
- Minimal retention of sensitive content.

## Options considered

### Option A: Asynchronous deletion event only

Memory Service soft-deletes the row and publishes an event; subscribers eventually remove copies.

Advantages:

- Simple and loosely coupled.
- Efficient steady-state operation.

Disadvantages:

- Cannot guarantee immediate disappearance.
- Publication failure can strand derived records.
- Consumers may continue using stale content.

### Option B: Synchronously delete every downstream representation

Memory Service calls Search, caches, vector storage, graph storage, analytics, and every derived consumer before returning success.

Advantages:

- Strong immediate cleanup when all dependencies succeed.

Disadvantages:

- Creates tight coupling and a distributed transaction.
- Makes deletion unavailable when any subscriber is down.
- Conflicts with independent service ownership and fault isolation.
- Does not scale to future consumers.

### Option C: Authoritative tombstone barrier plus asynchronous physical purge

The Memory Service atomically marks the memory deleted and records an outbox event. A minimal deletion ledger/tombstone becomes the authoritative negative-access signal. Search, caches, AI retrieval, recommendation, personalization, and analytics must consult or receive this barrier before returning or processing candidate data. Physical cleanup remains asynchronous and idempotent.

Advantages:

- Immediate logical invisibility without synchronous distributed deletion.
- Preserves loose coupling and service ownership.
- Supports retries and future consumers.
- Separates user-visible deletion from legally required physical retention.

Disadvantages:

- Requires a highly available deletion barrier.
- Consumers must enforce the barrier consistently.
- Requires outbox, acknowledgements, and purge tracking.

## Recommended decision

Adopt **Option C**.

An owner-authorized `DELETE` of an already deleted or otherwise inaccessible memory returns `204 No Content`. The operation is idempotent. The normal owner-authorized delete path must not expose `MEMORY_ALREADY_DELETED`.

Minimum contract:

1. In one Memory Service transaction, set `deleted_at`, set `deletion_version`, exclude the record from every normal Memory query, create an immutable deletion-ledger entry, and create an outbox event.
2. Return success only after this authoritative transaction commits.
3. All Memory Service reads exclude deleted records unconditionally.
4. Search and every derived consumer must enforce an owner/resource deletion barrier before returning or processing results. A stale index hit is discarded.
5. Publish a content-free, versioned `MemoryDeletionRequired` event containing memory ID, owner ID, deletion version, deletion timestamp, and purge deadline when applicable.
6. Consumers process deletion idempotently and publish content-free completion acknowledgements.
7. Temporary retained rows contain the minimum data required for the approved retention purpose and remain inaccessible to normal code paths.
8. After the retention deadline and required acknowledgements, a purge worker deletes database rows, embeddings, vector records, search documents, graph links, caches, analytics/derived records, and the content-bearing portions of operational records.
9. A non-content tombstone may remain only as long as necessary to prevent resurrection by delayed events; its retention period requires separate approval.
10. Legal holds are explicit, auditable, and do not restore user-visible access.

## Consequences

### Positive

- Meets immediate user-visible deletion semantics.
- Keeps physical cleanup asynchronous and resilient.
- Prevents delayed events from resurrecting data.
- Supports distributed deletion auditing without exposing content.

### Negative

- Every derived consumer must implement barrier enforcement.
- Tombstone and acknowledgement retention need approved durations.
- Operational complexity increases.
- Search availability depends on safe deletion-barrier behavior; uncertainty must fail closed.

### Required follow-up specifications

- Deletion ledger and outbox entities.
- Deletion event and acknowledgement payloads.
- Purge deadline and legal-hold model.
- Consumer registration and completion criteria.
- Barrier lookup/cache protocol and latency target.
- Rules for backups and disaster recovery copies.

## Affected services

- Memory Service
- Search Service
- Recommendation Service
- Analytics Service
- AI Orchestrator and AI Memory Retrieval in later milestones
- Personalization components in later milestones
- Cache infrastructure
- Vector and graph stores in later milestones

## Affected documents

- `docs/api/m2/memory-service.md`
- `docs/api/m2/search-service.md`
- `docs/api/m2/common-contracts.md`
- `docs/api/m2/openapi.yaml`
- `PRODUCT_SPEC.md`
- `DATABASE_SCHEMA.md`
- `MEMORY_ARCHITECTURE.md`
- `SERVICE_ARCHITECTURE.md`
- `SYSTEM_ARCHITECTURE.md`
- `AI_PIPELINE.md`
- `API_SPEC.md`
