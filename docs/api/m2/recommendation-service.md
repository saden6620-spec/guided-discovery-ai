# Recommendation Service Contract

Status: Final

Recommendation Service owns recommendations, score inputs, and append-only disposition history. M2 stores completed recommendations from approved deterministic service producers; it does not generate, rank, personalize, or use AI.

Canonical states are `AVAILABLE`, `ACCEPTED`, `REJECTED`, `DISMISSED`, `IGNORED`, and `EXPIRED`. Accept and dismiss are distinct user actions. Reject is a distinct user decision reserved for a later public endpoint; ignored and expired are system outcomes. M2 public transitions are available-to-accepted and available-to-dismissed; the expiry worker may move available-to-expired. Repeated same action is idempotent; a different terminal disposition conflicts.

Public routes, response DTOs, filters, errors, and expected-version rules are in `openapi.yaml`. Internal ingestion is in `internal-openapi.yaml`; storage/history in `database-entities.md`; events in `asyncapi.yaml`.
