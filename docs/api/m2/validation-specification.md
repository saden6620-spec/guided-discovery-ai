# M2 Validation, Concurrency, and Conflict Specification

Status: Final

## Validation order

Every HTTP operation applies these steps in order: transport limits, authentication, syntax/schema validation, canonicalization, authoritative authorization, resource visibility, optimistic concurrency, lifecycle/business validation, atomic persistence plus outbox, and response assembly. Validation never performs a state mutation. Authorization failures are not converted into validation details.

## Shared field rules

- Request bodies are at most 1 MiB; Search query URLs are at most 8 KiB.
- JSON depth is at most 20, object properties at most 200, and unknown properties are rejected.
- UUIDs use canonical lowercase hyphenated format; nil UUID is invalid.
- Datetimes use RFC 3339 UTC with a `Z` suffix and millisecond precision. Full dates use `YYYY-MM-DD`.
- Human text is valid Unicode, NFC-normalized, trimmed at its boundary, and cannot contain NUL or Unicode control characters except tab/newline in multiline content.
- Identifiers, enum values, currency codes, category keys, and policy codes are ASCII.
- Decimal amounts are transmitted as strings matching `^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$`; negative zero is invalid.
- `expectedVersion` is an integer from 1 through 2147483647.
- Empty PATCH bodies and explicit `null` for non-nullable fields return `422 VALIDATION_FAILED`.
- Field error paths use RFC 6901 JSON Pointer for bodies and `query/<name>`, `header/<name>`, or `path/<name>` elsewhere.

## Canonicalization

Canonical request hashing uses RFC 8785 JSON Canonicalization after schema validation and Unicode normalization. Headers, authentication tokens, request ID, trace headers, and incidental whitespace are excluded. Route, method, authenticated principal, and canonical body are included.

## Idempotency

- `Idempotency-Key` is required for public and internal state-creating/action commands identified in OpenAPI, including internal idempotent PUT and legal-hold release; it is forbidden on ordinary reads and PATCH operations.
- Format: 16–128 printable ASCII characters; leading/trailing whitespace and control characters are invalid.
- Scope: environment, authenticated principal, service, HTTP method, and normalized route template.
- A record is written atomically with the state transition and retained 30 days under `O2_RELIABILITY`.
- Concurrent identical requests permit one executor; followers wait at most five seconds, then return `409 IDEMPOTENCY_IN_PROGRESS` with `Retry-After: 1`.
- Same key and request hash returns the original status, headers relevant to the contract, and body.
- Same key and different hash returns `409 IDEMPOTENCY_KEY_REUSED`.
- Failed authentication, rate limiting, and pre-schema validation are not stored. Deterministic post-authentication 4xx results are stored for 24 hours; 5xx and 503 results are not stored.

## Optimistic concurrency

- Every mutable aggregate has a positive integer `version` incremented once per committed command.
- PATCH and state-changing action bodies require `expectedVersion`; omission is `422 EXPECTED_VERSION_REQUIRED`.
- A mismatch returns `409 VERSION_CONFLICT` without current resource content.
- Child mutation operations compare the parent version and execute in one transaction. Child versions also increment for their own update.
- Event `subjectVersion` equals the committed aggregate version. Consumers ignore a version at or below their recorded version unless it is an idempotent replay of the same event ID; a gap is retried then quarantined.

Memory PATCH treats a non-empty `correctionReason` as an explicit factual correction and writes `verificationStatus=CORRECTED` on the new immutable version. Supplying a correction reason without changing `title`, `summary`, or `purpose` is invalid. Content changes without a correction reason are ordinary updates and preserve the prior verification status. Setting `userConfirmed=true` records `USER_CONFIRMED` and `userConfirmedAt`; setting it false clears the timestamp and returns to `UNVERIFIED` unless the current version is `SOURCE_VERIFIED` or `CORRECTED`.

## Lifecycle and conflict rules

- Invalid requested transitions return `409 INVALID_STATE_TRANSITION` with `metadata.currentState` and `metadata.requestedAction`; inaccessible resources still return 404.
- Repeating an already-achieved idempotent transition returns the current resource and does not append duplicate history or events.
- Recommendation action on a different terminal disposition returns `409 RECOMMENDATION_ALREADY_RESOLVED`.
- Expired recommendation actions return `409 RECOMMENDATION_EXPIRED`; expiry is atomically recorded before the response.
- Navigation start conflicts when an active session exists unless it is an idempotent replay. Stop outcome `COMPLETED` completes the trip and `CANCELLED` cancels it. `PAUSED` and `REPLACED` are future canonical states and are absent from M2 wire and database contracts.
- A delivered notification cannot be cancelled. M2 cannot reach delivered through normal runtime. Cancel/expire on the same terminal state is idempotent; different terminal state conflicts.
- Delete of an owner-authorized missing or already inaccessible memory returns 204. Other protected resources use privacy-preserving 204 repeated delete only when the service can authenticate ownership from its deletion ledger; otherwise they return privacy-preserving 404.

## Aggregate child mutations

Plan and journal PATCH use operation arrays rather than replacing child arrays:

```json
{
  "expectedVersion": 3,
  "itemOperations": [
    { "operation": "CREATE", "clientReference": "local-1", "value": {} },
    { "operation": "UPDATE", "id": "uuid", "expectedVersion": 2, "value": {} },
    { "operation": "DELETE", "id": "uuid", "expectedVersion": 2 }
  ]
}
```

- Operations are evaluated in array order and commit atomically.
- `CREATE` requires `clientReference` unique within the request and forbids `id`.
- `UPDATE` and `DELETE` require stable `id` and child `expectedVersion` and forbid `clientReference`.
- The same child ID may occur at most once per request.
- A missing, deleted, or foreign child returns the parent-domain not-found code without disclosing ownership.
- Journal entry, reflection, and media-reference creates and updates require explicit non-negative positions. Positions must be unique within each resulting child collection after all operations. Services compact positions to contiguous values atomically before commit.
- `JournalEntry.mediaReferenceId` is the sole entry-to-media relationship. A media reference contains no reverse entry ID and may exist unreferenced. Text entries have no media reference; reference entries have exactly one active, accessible, same-journal `JournalMediaReference` with the matching media kind. A media reference grants no access to the underlying media.
- A journal PATCH resolves mutation phases in fixed order: `mediaOperations`, `entryOperations`, then `reflectionOperations`, preserving array order inside each phase. An entry's `mediaReferenceClientReference` may resolve only to a media-reference create operation completed in the earlier media phase. Client references are unique request-wide, dependency-only, non-persistent, and absent from responses. Unknown, duplicate, forward-unresolvable, cyclic, inaccessible, cross-journal, and kind-mismatched references reject the entire transaction.
- Journal creation accepts only TEXT entries through `CreateJournalEntryInput`. Reference entries and all media-reference mutations are prohibited during creation and are available only through the atomic PATCH flow.

## Domain validation registry

| Code                         | Condition                                    | HTTP |
| ---------------------------- | -------------------------------------------- | ---: |
| `DATE_RANGE_INVALID`         | End precedes start                           |  422 |
| `BUDGET_PAIR_REQUIRED`       | Amount and currency not supplied together    |  422 |
| `CHILD_LIMIT_EXCEEDED`       | Resulting child collection exceeds its limit |  422 |
| `CONTENT_MEDIA_EXCLUSIVE`    | Journal entry content/media shape is invalid |  422 |
| `CATEGORY_NOT_FOUND`         | Active system memory category absent         |  422 |
| `POLICY_REFERENCE_INVALID`   | Permission or retention reference is unknown |  422 |
| `ROUTE_DESTINATION_MISMATCH` | Route does not end at requested destination  |  409 |
| `ACTIVE_NAVIGATION_EXISTS`   | User already has active navigation           |  409 |
| `SOURCE_VERSION_STALE`       | Producer version is older than current       |  409 |
| `CURSOR_CONTEXT_MISMATCH`    | Cursor does not match filters/query/profile  |  400 |
| `CURSOR_EXPIRED`             | Cursor older than 15 minutes                 |  400 |

## Error privacy

Validation messages state constraints but never echo secrets, tokens, memory content, notification destination, search query, or inaccessible identifiers. Logs record error code and field path only. `404 RESOURCE_NOT_FOUND` is used for absent and unauthorized resources. Permission uncertainty is `503 PERMISSION_UNAVAILABLE`, never an allow.
