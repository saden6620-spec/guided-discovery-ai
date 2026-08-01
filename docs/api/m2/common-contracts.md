# M2 Common API and Data Contracts

Status: Final

## HTTP conventions

Public routes use `/api/v1`; private routes use `/internal/v1`. JSON uses `application/json`. Public requests require user bearer authentication and internal requests require workload bearer authentication. Clients cannot assert ownership or authorization.

Every normal success uses `{ "success": true, "data": ..., "metadata": {...} }`. Errors use `{ "success": false, "error": { "code", "message", "requestId", "fields"? }, "metadata": {} }`. `204 No Content` is the only normal unenveloped success.

Required contract headers are `X-Request-ID`, W3C `traceparent`, optional `tracestate`, and `Idempotency-Key` on designated commands. Rate-limit responses use `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and `Retry-After` for 429.

## Identifiers and time

Resource identifiers are opaque canonical lowercase UUIDs. IDs never encode service, owner, type, or time. API timestamps are UTC RFC 3339 with millisecond precision. Database timestamps are `timestamptz` UTC.

## Pagination

Collection metadata is `{ nextCursor: string|null, hasMore: boolean, limit: integer }`. Limit defaults to 25 and ranges 1–100. Cursors are signed opaque tokens bound to principal, route, normalized filters, sort, last ordering tuple, and contract/index versions. They expire after 15 minutes. Normal lists order by `(createdAt desc,id desc)` unless their operation defines another order. Search cursors additionally bind query-cache digest, ranking profile, index versions, and per-index continuation state; raw query text is never in the cursor.

## Authorization and privacy

Permission Service provides authoritative synchronous decisions under `internal-service-contracts.md`. Domain ownership fields and Search permission projections are non-authoritative. Protected reads and writes fail closed. An absent and an unauthorized resource both return `404 RESOURCE_NOT_FOUND`. Content, raw Search queries, secrets, coordinates, notification destinations, and inaccessible identifiers are absent from logs and errors.

## Idempotency and concurrency

`validation-specification.md` defines canonical hashing, 30-day records, concurrent request behavior, replay, and conflicts. Mutable aggregates expose positive `version`; every PATCH/action requires `expectedVersion` except idempotent DELETE. State and outbox writes commit in one service-local transaction.

## Standard errors

| HTTP | Codes                                                                                                                 |
| ---: | --------------------------------------------------------------------------------------------------------------------- |
|  400 | `INVALID_REQUEST`, `INVALID_CURSOR`, `CURSOR_EXPIRED`, `CURSOR_CONTEXT_MISMATCH`                                      |
|  401 | `AUTHENTICATION_REQUIRED`, `SERVICE_AUTHENTICATION_REQUIRED`                                                          |
|  403 | `ACCESS_DENIED`, `SERVICE_ACCESS_DENIED`, `PRODUCER_NOT_ALLOWED`                                                      |
|  404 | `RESOURCE_NOT_FOUND` and service-specific not-found aliases                                                           |
|  409 | `VERSION_CONFLICT`, `INVALID_STATE_TRANSITION`, `IDEMPOTENCY_KEY_REUSED`, `IDEMPOTENCY_IN_PROGRESS`, domain conflicts |
|  422 | `VALIDATION_FAILED`, `EXPECTED_VERSION_REQUIRED`, stable validation-rule codes                                        |
|  429 | `RATE_LIMITED`                                                                                                        |
|  500 | `INTERNAL_ERROR`                                                                                                      |
|  503 | `DEPENDENCY_UNAVAILABLE`, `PERMISSION_UNAVAILABLE`, `SEARCH_UNAVAILABLE`                                              |

OpenAPI lists explicit statuses per operation. Error messages are safe summaries; clients branch on code, not message.

## Contract compatibility

Public/internal HTTP breaking changes require a new API major version. Optional additive response fields require a documented minor contract change and consumer compatibility evidence. Event compatibility follows `asyncapi.yaml`. Database evolution follows `operational-contracts.md` and ADR-0009.
