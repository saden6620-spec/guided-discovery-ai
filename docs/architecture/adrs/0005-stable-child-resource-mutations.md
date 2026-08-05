# ADR-0005: Stable Child-Resource Mutation Semantics

- Status: Accepted
- Date: 2026-08-01
- Decision scope: Planning and Documentation aggregate children

## Context and problem

The public API defines PATCH operations for plans and journals but no child-resource endpoints for itinerary items, reservations, checklist items, journal entries, reflections, or media references. The draft contract proposes replacing entire child arrays when supplied. Input children do not carry stable IDs, so replacement would delete and recreate records.

## Why it matters

- Child IDs would change after ordinary edits.
- Audit and event histories would lose continuity.
- Concurrent updates could silently delete another writer's changes.
- Omitted children could be interpreted as deletion.
- References to child resources could become invalid.
- Database versioning and rollback behavior would be ambiguous.

## Decision drivers

- Preserve documented public endpoints.
- Maintain stable resource identity.
- Support partial updates safely.
- Keep aggregate ownership inside the correct service.
- Avoid adding unnecessary public child CRUD APIs.
- Make deletions explicit and auditable.

## Options considered

### Option A: Replace complete child arrays

Advantages:

- Simple request shape.
- One transaction updates the aggregate.

Disadvantages:

- Destroys child identity.
- Makes concurrent edits unsafe.
- Cannot distinguish omission from deletion reliably.
- Produces noisy events and audit history.

### Option B: Add public CRUD endpoints for every child resource

Advantages:

- Conventional resource semantics.
- Fine-grained concurrency and errors.

Disadvantages:

- Expands `API_SPEC.md` beyond documented endpoints.
- Creates a much larger public surface.
- Allows clients to bypass aggregate invariants unless carefully constrained.

### Option C: Aggregate PATCH with explicit ID-based mutation operations

The existing parent PATCH accepts scalar changes plus explicit child mutation sets. Existing children require IDs and expected versions; new children omit IDs; deletion uses explicit ID lists. All changes occur in one aggregate transaction.

Advantages:

- Preserves current public endpoint scope.
- Maintains stable IDs and audit history.
- Makes deletion explicit.
- Supports optimistic concurrency.
- Preserves aggregate invariants.

Disadvantages:

- DTOs are more complex.
- Batch failures require clear field paths.
- Very large aggregates may later require child endpoints.

## Recommended decision

Adopt **Option C** for M2.

### Plan PATCH shape

The approved shape uses scalar parent fields alongside ordered operation arrays:

- `itemOperations` containing `CREATE`, `UPDATE`, or `DELETE` operations.
- `reservationOperations` containing `CREATE`, `UPDATE`, or `DELETE` operations.
- `checklistOperations` containing `CREATE`, `UPDATE`, or `DELETE` operations.

Each operation is discriminated by its `operation` field. This operation-array model is the authoritative public contract defined in `docs/api/m2/openapi.yaml`; child collections are never replaced implicitly.

Every update child includes `id` and `expectedVersion`. Every delete entry includes `id` and `expectedVersion`. Creates have no ID. Array order is represented by an explicit non-negative `position` and validated for uniqueness within the aggregate.

### Journal PATCH shape

The same pattern applies to:

- Journal scalar fields.
- `entries.create/update/delete`.
- `reflections.create/update/delete`.
- `mediaReferences.create/update/delete`.

Media references contain only a Media Service resource ID and documentation-owned metadata. Cross-service references have no foreign keys.

`JournalMediaReference` is the sole Documentation persistence owner of opaque Media Service IDs. `JournalEntry.mediaReferenceId` is the sole owner of the entry-to-media-reference relationship; media-reference resources contain no reverse entry ID and may exist without an entry. A reference-type journal entry points to exactly one stable Documentation-owned media-reference child ID; it never persists the Media Service ID itself. A text entry has no media reference, and any entry references at most one. Within one journal PATCH, an entry create or update may instead identify a media-reference create operation by its request-scoped `clientReference`. These references are unique within the entire request, resolve only to an earlier create operation, are discarded after dependency resolution, and never become or appear as canonical resource IDs.

Journal creation may embed only TEXT entries through the dedicated `CreateJournalEntryInput` contract. It has no media-reference operations. Reference entries are created only through PATCH after the media-reference create phase described below.

Mutation dependencies are processed in the fixed phase order `mediaOperations`, `entryOperations`, then `reflectionOperations`, preserving array order inside each phase, after validating the complete dependency graph. Unknown, duplicate, forward-unresolvable, cyclic, cross-journal, inactive, inaccessible, or media-kind-mismatched references reject the entire request. Position values are required non-negative integers for every journal child create and update, must be unique within each resulting child collection, and are compacted to contiguous values atomically before commit.

### Transaction rules

1. Validate the entire mutation, request-scoped references, and dependency graph before writing.
2. Verify aggregate and child ownership.
3. Verify parent and supplied child versions.
4. Apply all changes in one owning-service database transaction.
5. Increment only changed resource versions.
6. Record explicit deletion timestamps where the approved retention policy requires soft deletion.
7. Add outbox events in the same transaction.
8. Return the complete updated aggregate.
9. Any invalid mutation rejects the entire request with field-specific errors.

If aggregate size later exceeds practical request or transaction limits, adding child endpoints requires a separately approved API decision.

## Consequences

### Positive

- Child identity and history remain stable.
- Existing public endpoint scope is preserved.
- Concurrent writes fail predictably.
- Deletions are explicit and reviewable.
- Aggregate invariants remain centralized.

### Negative

- Request DTOs and OpenAPI schemas are more verbose.
- Clients must track child IDs and versions.
- Batch mutation error reporting is more complex.
- Position management requires validation.

### Required follow-up specifications

- Exact mutation DTOs.
- Maximum batch sizes.
- Position collision behavior.
- Per-child validation rules.
- Aggregate and child error codes.
- Retention rules for deleted plan and journal children.

## Affected services

- Planning Service
- Documentation Service
- API Gateway

## Affected documents

- `docs/api/m2/planning-service.md`
- `docs/api/m2/documentation-service.md`
- `docs/api/m2/common-contracts.md`
- `docs/api/m2/openapi.yaml`
- `API_SPEC.md`
- `DATABASE_SCHEMA.md`
- `SERVICE_ARCHITECTURE.md`
- `SYSTEM_ARCHITECTURE.md`
- `PRODUCT_SPEC.md`
- `MEMORY_ARCHITECTURE.md`
- `AI_PIPELINE.md`
