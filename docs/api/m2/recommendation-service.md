# Recommendation Service Contract

Status: Final

Recommendation Service owns recommendations, score inputs, and append-only disposition history. M2 stores completed recommendations from approved deterministic service producers; it does not generate, rank, personalize, or use AI.

Canonical states are `AVAILABLE`, `ACCEPTED`, `REJECTED`, `DISMISSED`, `IGNORED`, and `EXPIRED`. Accept and dismiss are distinct user actions. Reject is a distinct user decision reserved for a later public endpoint; ignored and expired are system outcomes. M2 public transitions are available-to-accepted and available-to-dismissed; the expiry worker may move available-to-expired. Repeated same action is idempotent; a different terminal disposition conflicts.

Public routes, response DTOs, filters, errors, and expected-version rules are in `openapi.yaml`. Internal ingestion is in `internal-openapi.yaml`; storage/history in `database-entities.md`; events in `asyncapi.yaml`.

Internal ingestion requires a non-empty `permissionPolicyRef` of at most 128 characters and a positive `permissionVersion`. The authenticated producer may request the policy reference only through the private contract. Recommendation Service validates it and resolves the authoritative current version through Permission Service before insertion; producer input never self-authorizes access. Unavailable, invalid, stale, revoked, or denied permission decisions fail closed. The committed policy reference and version are persisted and included in protected recommendation events where event privacy permits, but permission details are never exposed in public responses or logs.

M2.5 supports only scalar `SAFETY` and `ACCESSIBILITY` recommendation score factors. Structured safety and accessibility attributes remain deferred and no DTO, field, table, column, public response, or event payload is defined for them.
