# ADR-0011: Memory Record Semantics

- Status: Accepted
- Date: 2026-08-01
- Decision scope: Canonical M2 memory aggregate, metadata, history, links, and lifecycle

## Context

The architecture requires memories to be explainable, permission-controlled, privacy-preserving, and immediately removable from all normal behavior. Existing documents describe categories, importance, provenance, links, encryption, versioning, and deletion at different levels, but do not define one canonical record or distinguish current state from immutable history.

ADR-0001 makes the Permission Service authoritative. ADR-0002 defines immediate logical deletion and distributed purge. ADR-0005 requires stable child identifiers. ADR-0006 defines reliable events. ADR-0008 governs retention, legal holds, backups, and purge.

## Problem

Without a canonical aggregate, API DTOs, database entities, events, Search projections, and later AI consumers could assign different meanings to confidence, confirmation, sensitivity, categories, versions, deletion, and links. That would weaken authorization, explainability, correction history, and deletion guarantees.

## Decision drivers

- Permission Service remains the sole authority for protected access.
- Users can learn why a memory exists and where it came from.
- Sensitive memories receive stronger protection.
- Current state and correction history remain distinguishable.
- Deletion immediately excludes current and historical content from normal behavior.
- Stable identifiers support idempotency and event ordering.
- M2 contains no embeddings, semantic retrieval, AI selection, or inferred-memory behavior.
- The smallest useful M2 contract avoids speculative AI fields.

## Viable options

### Option A: Minimal mutable memory row

Store content, category, owner, importance, timestamps, and deletion flag in one mutable row.

This is simple, but loses provenance and correction history and cannot adequately explain or audit changes.

### Option B: One wide row containing all current and historical metadata

Store current values plus serialized history, links, permission data, and purge data in one record.

This centralizes reads, but mixes authorities and lifecycle concerns, produces fragile updates, and makes selective purge difficult.

### Option C: Canonical aggregate with current record, append-only versions, and stable links

Memory Service owns a current memory record, append-only version records, stable link records, and deletion/purge state. It stores references to authoritative permission and retention policies rather than copying their rules.

This adds several related entities, but preserves ownership, history, explainability, and reliable purge boundaries.

## Tradeoff analysis

Option A is smallest in storage terms but does not meet documented explainability and history needs. Option B appears convenient but creates a large mixed-authority record and weak purge semantics. Option C adds modest relational complexity while keeping the Memory Service aggregate cohesive and external policy authorities explicit. It is the smallest option that satisfies the documented guarantees.

## Recommended decision

Adopt **Option C**. The canonical memory aggregate consists of a current `Memory`, immutable `MemoryVersion` records, optional `MemoryLink` records, and deletion/purge metadata. Permission decisions are never inferred from fields on these records: every protected operation uses ADR-0001.

## Detailed rules

### Identity and ownership

- `memoryId` is a globally unique, opaque, stable identifier owned by Memory Service.
- `ownerId` identifies the user who owns the memory; it is not an authorization grant.
- `categoryId` references a Memory Service-owned category.
- `currentVersionId` references the active immutable version.
- Clients cannot provide a permission result, `permissionVersion`, encryption state, verification result, deletion state, or purge state as authority.

### Current memory record

The current record contains:

- `memoryId`, `ownerId`, `categoryId`, and `currentVersionId`.
- `state`: `ACTIVE | ARCHIVED | DELETED_PENDING_PURGE | PURGED`.
- `importance`: a decimal in the inclusive range `0..1`; in M2 it is explicitly supplied or changed by an authorized user operation, never computed by AI.
- `sensitivity`: `STANDARD | SENSITIVE | HIGHLY_SENSITIVE`.
- `verificationStatus`: `UNVERIFIED | USER_CONFIRMED | SOURCE_VERIFIED | CORRECTED`.
- `permissionPolicyRef` and `permissionPolicyVersion`: opaque references to the Permission Service policy used for projection synchronization, not authorization substitutes.
- `retentionPolicyRef`: a reference to the applicable ADR-0008 retention policy.
- `createdAt`, `updatedAt`, and optional `archivedAt` in UTC.
- Optional `userConfirmedAt`; present only when the user has explicitly confirmed the current version.
- `deletionVersion`, `deletedAt`, and `purgeStatus` when deletion has begun.
- Optional `legalHoldRef`, which is opaque, access-restricted, and never exposes legal details through normal memory APIs.

`purgeStatus` is `NOT_SCHEDULED | SCHEDULED | IN_PROGRESS | COMPLETE | FAILED`. `PURGED` retains no content-bearing current or historical record; only the minimal tombstone allowed by ADR-0008 may remain.

### Immutable version record

Each `MemoryVersion` has a stable `memoryVersionId`, `memoryId`, positive monotonic `versionNumber`, encrypted content, `purpose`, provenance, `originatedAt`, `createdAt`, actor reference, and correction reason when applicable.

- `purpose` is a required user-readable explanation of why the information was remembered.
- `sourceType` is `USER_EXPLICIT | USER_CONFIRMED | IMPORT | SERVICE_EVENT`. `AI_INFERRED` is reserved for a later approved milestone and is invalid in M2.
- `sourceRef` is optional, opaque, and limited to an approved source identifier. It must not embed source content, credentials, URLs containing secrets, or authorization claims.
- `originatedAt` records when the remembered fact or source event originated when known; `createdAt` records when this version was persisted. They are not interchangeable.
- `confidence` is in `0..1`. M2 user-entered memories use `1`; imported or service-event memories require an explicitly supplied, source-defined value. M2 does not calculate confidence with AI.
- Explainability is formed from `purpose`, `sourceType`, optional safe `sourceRef`, `originatedAt`, verification status, and version history. It is still permission-filtered.

Updates never mutate a version. They append a new version and atomically update `currentVersionId`. A correction uses `verificationStatus: CORRECTED` and a non-empty correction reason. Historical versions are unavailable to ordinary list and search operations and require an explicitly authorized history operation.

### Sensitivity and encryption

- Content and content-bearing provenance are encrypted at rest before persistence.
- `encryptionState` is `PENDING | ENCRYPTED | ROTATION_REQUIRED | FAILED` operational metadata. A memory version is not available to normal reads unless its state is `ENCRYPTED`.
- `encryptionKeyRef` is an opaque key-management reference and never contains key material.
- `SENSITIVE` and `HIGHLY_SENSITIVE` memories require stricter access policy references, redacted logs, no content-bearing events, and no analytics content.
- `PENDING`, `ROTATION_REQUIRED`, or `FAILED` causes content reads to fail closed; recovery may repair encryption but may not bypass permission or deletion barriers.

### Categories

- Memory Service owns the category catalog and stable category identifiers.
- M2 may use only the explicitly approved system-category catalog defined by a follow-up specification and provisioned through migrations.
- User-defined categories, category deletion, and category merging are deferred.
- Permission Service governs access to memories in a category but does not own category definitions.

### Memory links

`MemoryLink` has a stable `memoryLinkId`, owner, source memory ID, target memory ID, type, timestamps, and version. Both memories must have the same owner and pass current authorization and deletion checks.

Canonical types are:

- `RELATED_TO`: symmetric; persist one canonical pair ordered by memory ID and reject the reverse duplicate.
- `SUPERSEDES`: directed from newer replacement to older memory.
- `SUPPORTS`: directed from supporting memory to supported memory.
- `CONTRADICTS`: symmetric; persist one canonical ordered pair.
- `PART_OF`: directed from component memory to containing memory.

Self-links are invalid. Link traversal is not semantic retrieval and is limited to explicitly requested, permission-filtered relations. Deleting either endpoint immediately removes the link from normal behavior and schedules its purge.

### Duplicate, merge, update, and correction semantics

- M2 performs no semantic duplicate detection and no automatic merge.
- An idempotent repeat of the same create command returns the originally created memory.
- Distinct creates remain distinct even if their content appears equal.
- Exact comparisons may occur transiently inside Memory Service for command validation but no content-derived hash or correlator is durably stored solely for deduplication.
- A factual correction normally appends a version to the same memory.
- Creating a separate replacement is explicit and may add a `SUPERSEDES` link; it does not silently delete or merge the older memory.
- Merge workflows, conflict resolution, and AI-assisted consolidation are deferred.

### Archive, deletion, legal hold, and purge

- `ACTIVE -> ARCHIVED` and `ARCHIVED -> ACTIVE` are authorized user transitions. Repeating the requested state is idempotent.
- Archive changes ordinary default visibility but is not deletion and does not bypass authorization.
- Deletion from `ACTIVE` or `ARCHIVED` atomically enters `DELETED_PENDING_PURGE`, increments `deletionVersion`, and applies ADR-0002.
- Owner-authorized repeated deletion follows ADR-0002 and returns `204 No Content`.
- Legal hold may delay physical purge under ADR-0008 but never restores normal visibility.
- Purge removes content, every version, links, projections, caches, derived records, and key references as applicable. A minimal non-content tombstone may remain only under ADR-0008.
- No transition out of `DELETED_PENDING_PURGE` or `PURGED` restores a memory through normal APIs.

### Events

- `MemorySaved` identifies `operation: CREATED | UPDATED` and carries IDs, versions, classification metadata, and permitted projection metadata but no memory content by default.
- `MemoryArchived` and `MemoryRestored` represent archive transitions.
- `MemoryDeletionRequired` and `MemoryPurged` follow ADR-0002 and ADR-0006.
- Link events use `MemoryLinkCreated` and `MemoryLinkDeleted` with stable link and endpoint IDs.
- Events cannot grant access and consumers must enforce current permission and deletion barriers.

## Consequences

### Positive

- API, database, events, Search projections, and later AI consumers share one meaning for memory metadata.
- Users can receive permission-filtered provenance and change explanations.
- Corrections preserve stable identity and audit history.
- Deletion and purge cover current content, versions, and links.

### Negative

- Version and link entities add transactional and purge complexity.
- System-category provisioning and policy-reference contracts require follow-up specifications.
- Explainability reads require careful redaction and authorization.

## Security and privacy impact

Memory content is encrypted, excluded from logs and ordinary events, and guarded by current Permission Service decisions. Sensitive classifications fail closed under encryption or policy uncertainty. Provenance and history may themselves be sensitive and receive the same authorization and deletion treatment as content. No durable content-derived duplicate hash is introduced.

## Failure behavior

- Permission uncertainty returns the standard authorization or dependency error and no content.
- Encryption unavailable or non-`ENCRYPTED` state fails closed.
- Version creation and current-version update commit atomically; a partial update is not visible.
- Event publication uses the transactional outbox in ADR-0006.
- Stale version, archive, link, or deletion commands return the approved conflict response unless their explicitly defined repeat behavior is idempotent.
- Purge failures retain logical deletion, retry safely, and raise restricted operational alerts without content.

## M2 scope

- Canonical current record, version, category reference, and explicit links.
- User-explicit, user-confirmed, import, and approved service-event provenance.
- Explicit importance and confidence values without AI calculation.
- System-category provisioning after catalog approval.
- Archive/unarchive, update/correction, explainability metadata, immediate deletion, and purge tracking.
- Permission, encryption, retention, outbox, and Search-projection integration contracts.

## Deferred scope

- Embeddings, vector or semantic retrieval, graph reasoning, and AI memory selection.
- AI-inferred memories, automatic confidence, importance, duplicate detection, merge, or link generation.
- User-defined categories and category lifecycle management.
- Cross-owner or shared-memory links.
- Restoration of deleted memories.

## Affected services

- Memory Service
- Permission Service
- Search Service
- API Gateway
- Analytics Service
- Key-management and storage infrastructure
- AI Orchestrator, Recommendation Service, and Personalization components in later milestones

## Affected documents

- `docs/api/m2/memory-service.md`
- `docs/api/m2/search-service.md`
- `docs/api/m2/common-contracts.md`
- `docs/api/m2/openapi.yaml`
- Future M2 event specification
- `PRODUCT_SPEC.md`
- `SYSTEM_ARCHITECTURE.md`
- `SERVICE_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `MEMORY_ARCHITECTURE.md`
- `API_SPEC.md`
- `AI_PIPELINE.md`

## Required follow-up specifications

- Exact Memory, MemoryVersion, MemoryLink, and explainability DTOs and database schemas.
- Approved initial system-category catalog and stable identifiers.
- Permission-policy reference and projection DTOs.
- Encryption adapter, key-reference, and rotation contract.
- Retention-policy reference and legal-hold authorization contract.
- Idempotency key, version precondition, and conflict error rules.
- Event payload and AsyncAPI definitions.
- Purge acknowledgement and tombstone schemas.

## Acceptance criteria

- One canonical record model defines every field named by this decision.
- Permission references are never treated as client-provided authorization.
- Every persisted content version is encrypted before normal availability.
- Purpose, provenance, origin time, creation time, and verification are distinguishable.
- Updates append immutable versions; corrections retain stable memory identity.
- M2 performs no semantic deduplication, merge, embedding, or AI selection.
- Links have stable IDs, defined direction, and deletion-barrier enforcement.
- Deletion immediately excludes current content, history, and links from all normal behavior.
- Legal hold delays only physical purge and cannot restore visibility.
- Purge covers current records, versions, links, projections, caches, and derived data.
