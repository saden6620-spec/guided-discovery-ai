# M2 Internal Service Contracts

Status: Final

This document is authoritative for non-public M2 commands and synchronous service-to-service queries. These routes are exposed only on the private service network, are excluded from the public API Gateway, and require an authenticated workload identity. ADR-0001 through ADR-0011 govern conflicts.

## Common transport rules

- Base path: `/internal/v1`.
- Media type: `application/json`.
- Required headers: `Authorization: Bearer <service-token>`, `X-Request-ID`, `traceparent`, and `Idempotency-Key` for commands.
- Optional tracing header: `tracestate`.
- Service tokens identify `serviceId`, environment, and allowed operation scopes. End-user tokens are invalid on internal routes.
- The caller supplies `actorId` only when forwarding an already authenticated user action. The receiving service verifies the workload scope and independently authorizes the actor through Permission Service.
- Responses use `{ success, data, metadata }`; errors use the common error envelope. `204` is the only success without an envelope.
- UUIDs are lowercase RFC 4122 strings. Timestamps are UTC RFC 3339 with millisecond precision.
- Unknown fields are rejected. Strings are Unicode NFC-normalized and trimmed unless explicitly content-preserving.
- Command idempotency records are retained under `O2_RELIABILITY`. Same key and canonical request returns the original response; different request returns `409 IDEMPOTENCY_KEY_REUSED`.

## Permission Service

Permission Service is authoritative. A projection, token claim, domain field, or client assertion never grants access.

### POST `/internal/v1/authorization/check`

Request `AuthorizationCheckRequest`:

| Field                     | Type            | Rules                                                                  |
| ------------------------- | --------------- | ---------------------------------------------------------------------- |
| `principalId`             | UUID            | Required authenticated user or service principal                       |
| `actorType`               | enum            | `USER` or `SERVICE`                                                    |
| `action`                  | enum            | `READ`, `CREATE`, `UPDATE`, `DELETE`, `INDEX`, `DELIVER`, `ADMINISTER` |
| `resourceType`            | string          | `^[A-Z][A-Z0-9_]{1,63}$`                                               |
| `resourceId`              | UUID or null    | Required for existing-resource operations                              |
| `ownerId`                 | UUID or null    | Owner asserted by owning service; checked by Permission Service        |
| `purpose`                 | string          | Approved purpose code, `^[a-z][a-z0-9_.-]{2,63}$`                      |
| `sensitivity`             | enum            | `STANDARD`, `SENSITIVE`, `HIGHLY_SENSITIVE`                            |
| `permissionPolicyRef`     | string or null  | Opaque policy reference, max 128                                       |
| `permissionPolicyVersion` | integer or null | Positive; paired with policy reference                                 |
| `context`                 | object          | Optional, max 16 scalar entries; no resource content                   |

Response `AuthorizationDecision`:

| Field               | Type     | Rules                                                                  |
| ------------------- | -------- | ---------------------------------------------------------------------- |
| `decision`          | enum     | `ALLOW` or `DENY`                                                      |
| `decisionId`        | UUID     | Unique audit correlation                                               |
| `permissionVersion` | integer  | Positive authoritative version                                         |
| `policyRef`         | string   | Applied policy reference                                               |
| `policyVersion`     | integer  | Positive                                                               |
| `validUntil`        | datetime | Maximum 30 seconds after decision time                                 |
| `reasonCode`        | string   | Required for deny; stable non-sensitive code                           |
| `obligations`       | array    | `REDACT_CONTENT`, `NO_ANALYTICS`, `NO_INDEX`, `REQUIRE_REAUTH`; unique |

Permission Service returns `200` for both allow and deny. Dependency or evaluation uncertainty returns `503 PERMISSION_UNAVAILABLE`; callers fail closed.

### POST `/internal/v1/authorization/batch-check`

Request contains `checks`, 1–100 `AuthorizationCheckRequest` items, each with a unique `checkId` of 1–64 ASCII characters. Response contains exactly one result per check in request order. A partially unevaluated batch is rejected as `503`; it never treats missing results as allow. Target service budget is 100 ms p95 and 250 ms timeout. Callers may retry once within their request deadline.

### GET `/internal/v1/permissions/projection/{resourceType}/{resourceId}`

Returns non-authoritative indexing metadata: `ownerId`, `visibility`, `sensitivity`, `policyRef`, `policyVersion`, `permissionVersion`, `indexAllowed`, and `analyticsAllowed`. Search must still synchronously authorize protected results.

## Memory categories

### System catalog

M2 provisions these immutable categories. IDs are UUIDv5 values using the standard URL namespace and name `guided-discovery-ai:memory-category:v1:<KEY>`:

| ID                                     | Key                 | Display name      | Default sensitivity |
| -------------------------------------- | ------------------- | ----------------- | ------------------- |
| `cdbcc674-50be-5a1e-b0cc-aa75d3f42fd4` | `PROFILE`           | Profile           | `SENSITIVE`         |
| `98c7bc59-e1d0-5fef-a7b0-8928588f8ddf` | `GOAL`              | Goal              | `STANDARD`          |
| `449e6134-07e0-5bde-a58b-13b7060715d2` | `LEARNING_PROGRESS` | Learning progress | `STANDARD`          |
| `b114b5b1-77a5-5202-a2ef-da57edb5af5a` | `SKILL`             | Skill             | `STANDARD`          |
| `c753a23d-78e3-5f91-b9f8-e6de97c0128f` | `PREFERENCE`        | Preference        | `STANDARD`          |
| `59360882-2cb3-5604-832b-3d53b67e74ce` | `TRAVEL_HISTORY`    | Travel history    | `SENSITIVE`         |
| `d1b12e5c-6798-528a-94a2-00df444a6d0a` | `INTEREST`          | Interest          | `STANDARD`          |
| `077d9dcd-1614-58a6-806b-62049cf760a0` | `JOURNAL`           | Journal           | `SENSITIVE`         |
| `e60754fd-eba3-5eae-90cb-0a38e4abf899` | `EXPERIENCE`        | Experience        | `STANDARD`          |
| `00708797-403a-5bc2-bb85-fe8378c50eb9` | `HEALTH`            | Health            | `HIGHLY_SENSITIVE`  |
| `6cd8f1aa-e208-5d37-bfec-0927e6c48de4` | `SAFETY_PREFERENCE` | Safety preference | `HIGHLY_SENSITIVE`  |

The migration inserts these exact IDs and snapshot-tests the catalog. Renaming a display label requires a versioned specification change but never changes key or ID. M2 has no category creation, update, merge, or deletion command.

### GET `/internal/v1/memory-categories`

Returns all active system categories as `{ id, key, displayName, defaultSensitivity, version }`. It requires `memory.category.read` workload scope.

## Navigation provisioning

### PUT `/internal/v1/destinations/{destinationId}`

`DestinationUpsertRequest` contains:

- `provider`: 1–64 uppercase identifier.
- `providerReference`: 1–256 characters; unique with provider.
- `name`: 1–200 characters.
- `latitude`: decimal from -90 through 90 with at most 7 fractional digits.
- `longitude`: decimal from -180 through 180 with at most 7 fractional digits.
- `timezone`: IANA time-zone name, 1–64 characters.
- `accessibility`: object with booleans `wheelchairAccessible`, `stepFree`, and optional notes up to 1000 characters.
- `sourceVersion`: positive integer.

The path ID is producer-selected and stable. Lower or equal `sourceVersion` with identical content is idempotent; lower with different content returns `409 STALE_SOURCE_VERSION`.

### PUT `/internal/v1/routes/{routeId}`

`RouteUpsertRequest` contains `provider`, `providerReference`, `originDestinationId`, `destinationId`, `travelMode`, `distanceMeters` (integer 0–100000000), `durationSeconds` (integer 0–604800), `polyline` (encoded polyline string, max 1,000,000), `accessibility`, `validFrom`, optional `validUntil`, and positive `sourceVersion`. Origin and destination must exist; `validUntil` must follow `validFrom`.

Only `navigation.destination.write` and `navigation.route.write` workload identities listed in configuration may call these routes. Provisioning computes no route.

## Recommendation ingestion

### POST `/internal/v1/recommendations`

`CreateRecommendationCommand`:

| Field                 | Type             | Rules                                                                                       |
| --------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| `ownerId`             | UUID             | Required                                                                                    |
| `category`            | string           | Upper snake case, 2–64                                                                      |
| `title`               | string           | 1–200                                                                                       |
| `summary`             | string           | 1–5000                                                                                      |
| `rationale`           | string           | 1–5000; user-readable provenance, not hidden reasoning                                      |
| `confidence`          | decimal          | 0–1                                                                                         |
| `availableAt`         | datetime         | Required                                                                                    |
| `expiresAt`           | datetime or null | Must follow `availableAt`                                                                   |
| `permissionPolicyRef` | string           | Required server-resolved policy reference, 1–128 characters                                 |
| `permissionVersion`   | integer          | Required positive requested version; the service resolves the authoritative current version |
| `provenance`          | object           | `producer`, `sourceType`, optional `sourceResourceId`, positive `sourceVersion`             |
| `scores`              | array            | Exactly one per supplied factor; max 8                                                      |

Score factors are `SAFETY`, `EDUCATIONAL_VALUE`, `RELEVANCE`, `USER_INTEREST`, `TIMING`, `ACCESSIBILITY`, `CONFIDENCE`, and `URGENCY`; each score is decimal 0–1. Duplicate factors are invalid. M2 stores supplied values and performs no ranking or generation. Initial state is `AVAILABLE` unless `expiresAt <= now`, which is rejected rather than creating an expired record.

Allowed producers are configured workload identities with `recommendation.ingest`. M2 test fixtures may use a deterministic producer; AI producers are not enabled.

The authenticated producer may request `permissionPolicyRef` only through this private contract. Recommendation Service validates the reference and resolves the authoritative current version through Permission Service before insertion; the supplied version is never itself authorization. Unavailable, invalid, stale, revoked, or denied permission decisions fail closed. The committed policy reference and resolved version are persisted. Permission details are excluded from logs and public responses.

M2.5 safety and accessibility data is limited to the scalar `SAFETY` and `ACCESSIBILITY` score factors. Structured safety or accessibility attributes are deferred and are not part of this command.

## Notification scheduling

### POST `/internal/v1/notifications`

`ScheduleNotificationCommand`:

- `ownerId`: UUID.
- `kind`: uppercase snake case, 2–64.
- `channel`: `PUSH`, `EMAIL`, or `SMS`.
- `recipientRef`: opaque Auth/User Service reference, 1–256; never a raw address.
- `title`: 1–200.
- `body`: 1–10,000.
- `scheduledFor`: RFC 3339 timestamp from now through 365 days in the future.
- `expiresAt`: optional, after `scheduledFor` and no more than 30 days later.
- `provenance`: producer, source type, optional source resource ID/version.
- `permissionPolicyRef` and positive `permissionPolicyVersion`.

It always commits `SCHEDULED` and `NotificationScheduled`. When `scheduledFor <= now`, the scheduler may immediately execute the separate idempotent `SCHEDULED -> QUEUED` transition after that transaction. M2 queues provider-neutral jobs but has no production delivery adapter; `QUEUED` is terminal until a later milestone. Scheduling requires an authoritative `DELIVER` permission decision. Repeating the command uses normal idempotency.

## Search indexing

Search accepts events only; it exposes no indexing HTTP command. The authoritative event payloads are `SearchDocumentUpserted` and `SearchDocumentDeleted` in `asyncapi.yaml`.

M2 producers are:

- Memory Service: `MEMORY`.
- Navigation Service: `TRIP` and `LANDMARK`.
- Documentation Service: `JOURNAL`.

`LEARNING` and `COMMUNITY` remain valid query types but are reported `UNAVAILABLE` in M2. Producers require explicit topic publish ACLs. Search rejects events from any producer/resource-type pairing not listed above.

## Legal holds

Every data-owning service exposes the same private routes on its own internal base URL. Only a workload identity with `retention.legal-hold.admin` may call them; Permission Service additionally authorizes `ADMINISTER` for purpose `legal_hold`. These routes are never gateway-accessible.

### POST `/internal/v1/retention/legal-holds`

`CreateLegalHoldCommand` contains `authorityRef` (opaque, 1â€“128), `reasonCategory` (`LITIGATION|REGULATORY_REQUEST|SECURITY_INVESTIGATION|OTHER_AUTHORIZED`), optional `expiresAt`, `resources` (1â€“100 items of `{ resourceType, resourceId }` owned by the receiving service), and `actorId`. Free-form narrative and resource content are forbidden. The service creates one hold ID, applies the hold atomically to every listed existing resource, emits only a restricted audit event, and returns the hold metadata. Missing or foreign resources cause the whole command to fail without partial holds.

### DELETE `/internal/v1/retention/legal-holds/{holdId}`

Requires `expectedVersion`. Release is idempotent. It records release actor/time, increments the hold version, and atomically reschedules every deleted affected resource for immediate purge evaluation. Release never restores application visibility. A released hold remains as content-free `S1_AUDIT` evidence.

Holds use the standard idempotency contract. There is no public legal-hold API, no endpoint that reads held content, and no M2 country-specific duration.

## Internal errors

Internal operations use the common codes plus `SERVICE_AUTHENTICATION_REQUIRED`, `SERVICE_ACCESS_DENIED`, `PERMISSION_UNAVAILABLE`, `STALE_SOURCE_VERSION`, `PRODUCER_NOT_ALLOWED`, `DESTINATION_NOT_FOUND`, `ROUTE_NOT_FOUND`, `RECOMMENDATION_INVALID`, and `NOTIFICATION_SCHEDULE_INVALID`. Authentication errors are `401`; scope and producer errors `403`; missing dependencies `404`; version conflicts `409`; validation errors `422`; unavailable authority `503`.
