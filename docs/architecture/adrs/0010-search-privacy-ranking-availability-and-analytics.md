# ADR-0010: Search Privacy, Ranking, Availability, and Analytics

- Status: Accepted
- Date: 2026-08-01
- Decision scope: M2 Search API, indexes, producers, privacy, and failure behavior

## Context

Search owns its indexes and supports documented resource categories without reading another service's database. ADR-0001 establishes Permission Service authority, ADR-0002 establishes deletion barriers, ADR-0003 establishes indexing ingestion, ADR-0006 establishes event reliability, and ADR-0008 establishes retention limits.

## Problem

The draft Search specification leaves raw-query logging, query hashes, result identifiers, ranking, cursors, index-version consistency, partial results, unavailable categories, producer schemas, reindexing, and replay behavior unresolved. A stale or weakly authorized index can disclose protected or deleted data.

## Decision drivers

- Privacy-preserving defaults.
- No raw or reversible query-derived retention.
- Permission and deletion enforcement before results leave Search.
- Stable, explainable full-text ranking without semantic or AI behavior.
- Partial availability without silently misrepresenting completeness.
- Search-owned indexes and event-only ingestion.
- Deterministic replay and reindexing.

## Viable options

### Option A: Store raw queries and return errors when any index is unavailable

Tradeoffs:

- Simplifies debugging and analytics.
- Exposes sensitive intent and produces brittle availability.
- A single unavailable category prevents otherwise useful results.

### Option B: Store query hashes and return empty results for unavailable categories

Tradeoffs:

- Appears anonymous and resilient.
- Predictable queries can be recovered from hashes.
- Empty results falsely imply that no matching data exists.

### Option C: Store no query-derived identifiers and return explicit partial availability

Search records only consent-approved aggregate operational counters that cannot reconstruct queries. Results include availability metadata per requested category. Ranking and cursors bind to a stable index version. Protected candidates receive final authorization and deletion checks.

Tradeoffs:

- Strongest privacy and truthful availability.
- Less query-level product analytics and debugging evidence.
- Requires availability metadata and multi-index cursor state.

## Tradeoff analysis

Persisting queries would improve diagnostics but creates sensitive, correlatable data without a documented product need. Treating unavailable sources as empty is simple but misleading; failing every mixed search reduces availability unnecessarily. Privacy-preserving transient query handling plus explicit per-source availability and deterministic lexical ranking is the smallest M2 behavior that remains honest, authorized, and testable.

## Recommended decision

Adopt **Option C**.

## Detailed rules

### Query privacy

1. Raw queries are processed in memory for the request and are never persisted in application logs, analytics, traces, audit logs, queues, dead letters, or Search database tables.
2. Plain hashes, salted hashes, keyed hashes, tokens, embeddings, fingerprints, or any query-derived identifier intended to correlate repeated query text are not stored in M2.
3. Sensitive-query detection may occur only in memory to suppress prohibited telemetry; the classification and query text are discarded after the request.
4. Debug logs may record query length bucket, requested category count, duration, result count, status, and error code, but never terms or source-result IDs.
5. Product analytics are opt-in where consent is required and contain aggregate counts only. Aggregation cells with insufficient volume are suppressed; the minimum threshold requires follow-up approval.
6. Aggregate metrics follow ADR-0008 `A0_AGGREGATE` retention.
7. Security audit events record actor/service identity, action, status, and timestamp only when required; they do not record query text or result content.

### Authorization and deletion

1. Search indexes the minimal access projection defined by ADR-0001: owner ID, visibility, policy reference, permission version, deletion version/state, resource type, and source ID.
2. Candidate filtering uses the projection, followed by one authoritative batch authorization check before returning protected results.
3. Permission Service timeout, error, stale-version response, or unavailable decision causes protected candidates to be withheld. If no requested category can be safely authorized, Search returns `503 SEARCH_AUTHORIZATION_UNAVAILABLE`.
4. `PermissionChanged` invalidates affected projection/cache entries through ADR-0006.
5. Every candidate is checked against ADR-0002's deletion barrier. A stale index document is discarded immediately.
6. Delete events contain no searchable content and use a monotonic deletion version. Older upserts cannot overwrite a newer deletion.
7. Physical index cleanup follows ADR-0008 `D0_DERIVED` timing.

### Search result identity

Use only `sourceResourceId`. Remove the duplicate Search-specific `id` from public results. The tuple `(resourceType, sourceResourceId)` is the logical result identity. Internal OpenSearch document IDs are implementation details and are never exposed.

### Ranking

1. M2 ranking is lexical full-text ranking only.
2. Searchable fields are `title` and `body`; title matches receive a fixed higher field weight than body matches. Exact numeric weights require specification approval and are versioned as `rankingProfileVersion`.
3. Results sort by descending provider-neutral lexical score, then descending source `updatedAt`, then ascending `sourceResourceId` for deterministic ties.
4. Scores are internal and provider-specific; public responses do not expose a normalized `0..1` score because no stable cross-index meaning is documented.
5. M2 does not use embeddings, semantic similarity, personalization, recommendation scores, AI query expansion, or user-history boosting.

### Cursor stability

1. The cursor is opaque, integrity-protected, and contains no raw query.
2. It binds to a one-way request nonce held only for the active pagination window, requested resource types, last sort tuple, ranking profile version, and each participating index schema/version.
3. Search does not persist the raw query for pagination. The client repeats `q`; Search verifies it against a short-lived in-memory/request-cache digest that is never written to logs or durable analytics. Exact cache lifetime may not exceed 15 minutes and is `O1_TRANSIENT`.
4. If index or ranking versions no longer match, return `409 SEARCH_CURSOR_STALE`; never silently mix versions.
5. Cursors expire after 15 minutes and return `400 INVALID_CURSOR` after expiry.

### Availability and partial results

1. A request may target one or more resource types.
2. The response metadata contains `availability` entries with `type` and `status=AVAILABLE|UNAVAILABLE|UNAUTHORIZED`.
3. Available, authorized categories return results normally.
4. An unavailable requested category does not become an empty successful category; it is marked `UNAVAILABLE`.
5. If at least one category is available, return `200` with partial results, `metadata.partial=true`, and availability details.
6. If every requested category is unavailable, return `503 SEARCH_INDEX_UNAVAILABLE`.
7. If every requested category is unauthorized, return an empty `200` response without revealing that protected resources exist; availability uses `UNAUTHORIZED` only when disclosing category authorization is itself permitted. Otherwise it is omitted.
8. The contradictory `SEARCH_TYPE_UNAVAILABLE` behavior is replaced by the preceding rules.

### Index ownership and producers

Search Service exclusively owns OpenSearch indexes, aliases, mappings, index metadata, reindexing, and deletion application.

Approved M2 producers:

- Memory Service for `MEMORY`.
- Navigation Service for `TRIP` and `LANDMARK`.
- Documentation Service for `JOURNAL`.

`LEARNING` and `COMMUNITY` remain recognized API categories but have no M2 producer. Requests for them report `UNAVAILABLE`; M2 does not invent those domain implementations.

### Index events

`SearchDocumentUpserted` requires event envelope fields from ADR-0006 plus:

- `resourceType`
- `sourceResourceId`
- `sourceVersion`
- `schemaVersion`
- `ownerId` where user-owned
- `visibility`
- `permissionPolicyRef`
- `permissionVersion`
- `deletionVersion`
- `title`
- `body`
- `updatedAt`

`SearchDocumentDeleted` requires the same identity/version/access fields but contains no title or body.

Upserts with a source version older than or equal to the indexed version are idempotently ignored. A deletion version dominates all older source versions.

### Reindexing, replay, and failure

1. Mappings and ranking profiles are versioned.
2. Incompatible changes build a new index under ADR-0009.
3. Reindexing uses source-service replay events or an authorized paginated export contract; it never reads source databases.
4. Current permission and deletion barriers are applied during replay.
5. An alias changes only after count, schema, authorization, and deletion validation.
6. Failed reindexing leaves the current alias unchanged and records content-free failure metadata.
7. Dead-letter events follow ADR-0006 and ADR-0008 and cannot expose raw query data.

## Consequences

### Positive

- Search does not persist user intent.
- Partial availability is truthful and useful.
- Duplicate result identifiers are removed.
- Ranking and pagination become deterministic.
- Permission revocation and deletion are enforced even against stale indexes.

### Negative

- Query-level analytics and forensic debugging are unavailable.
- Batch permission checks add latency and dependency risk.
- Multi-index cursor state is more complex.
- Community and Learning searches remain unavailable during M2.

## Security and privacy impact

- Query text and query-derived correlators are prohibited from durable storage.
- Protected results fail closed.
- Public responses expose no internal index IDs or provider scores.
- Search events carry protected content only for the approved indexing purpose and must be encrypted in transit with restricted subscribers.

## Failure behavior

- Permission uncertainty withholds protected results.
- Deletion-barrier uncertainty withholds the candidate.
- Partial index failure returns explicit availability metadata when at least one category succeeds.
- Total index failure returns 503.
- Stale or expired cursors return explicit 409 or 400 errors.
- Reindex failure never changes the active alias.

## M2 scope

- Lexical Search for Memory, Trip, Landmark, and Journal producers.
- Permission and deletion enforcement.
- Privacy-safe aggregate operational metrics.
- Versioned indexes, deterministic ranking, stable cursors, and partial availability.

## Deferred scope

- Learning and Community producers.
- Semantic search, embeddings, vector search, personalization, AI query expansion, and cross-query analytics.
- Raw-query debugging systems.

## Affected services

- Search Service
- Memory Service
- Navigation Service
- Documentation Service
- Permission Service
- API Gateway
- Analytics Service

## Affected documents

- `docs/api/m2/search-service.md`
- `docs/api/m2/common-contracts.md`
- `docs/api/m2/openapi.yaml`
- ADR-0001, ADR-0002, ADR-0003, ADR-0004, ADR-0006, ADR-0008, ADR-0009
- `API_SPEC.md`
- `SERVICE_ARCHITECTURE.md`
- `SYSTEM_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `MEMORY_ARCHITECTURE.md`
- `PRODUCT_SPEC.md`
- `AI_PIPELINE.md`

## Required follow-up specifications

- Exact lexical ranking weights and `rankingProfileVersion`.
- Search availability metadata schema.
- Cursor signing/integrity mechanism and request-cache specification.
- Batch permission DTO and latency budget.
- Search event AsyncAPI schemas.
- Minimum aggregate-cell threshold.
- Authorized reindex export contract.

## Acceptance criteria

- No raw query or query-derived correlator is durably stored.
- Public results expose only `sourceResourceId` with resource type.
- Every protected result passes current permission and deletion checks.
- Unavailable categories are never represented as confirmed empty categories.
- Partial results include availability metadata.
- Ranking is lexical, deterministic, and versioned.
- Cursors bind to index and ranking versions and contain no raw query.
- Search has no direct access to source-service databases.
- Older replay events cannot resurrect deleted or newer documents.
