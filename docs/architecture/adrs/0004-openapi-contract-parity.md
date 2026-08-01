# ADR-0004: OpenAPI as the Complete HTTP Contract

- Status: Accepted
- Date: 2026-08-01
- Decision scope: M2 HTTP APIs and validation

## Context and problem

The project requires OpenAPI documentation to remain synchronized with implementation. The draft Markdown specifications contain validation and behavior not represented by `openapi.yaml`, including conditional journal-entry fields, date ordering, budget currency pairing, child mutation semantics, explicit error statuses, request/trace headers, and rate-limit behavior.

A syntactically valid OpenAPI file can therefore describe a weaker contract than the written specification.

## Why it matters

- Generated clients could send requests that the service rejects.
- Server validation could accept requests the written contract forbids.
- Tests and documentation would disagree.
- Error handling would remain unpredictable.
- Drift would violate the API-first and consistency principles.

## Decision drivers

- One machine-verifiable HTTP contract.
- No undocumented endpoint expansion.
- Field-level validation errors using the standard envelope.
- Stable client generation.
- Exact parity between DTO validation, tests, and documentation.

## Options considered

### Option A: Markdown is authoritative; OpenAPI is illustrative

Advantages:

- Easy to write nuanced rules.

Disadvantages:

- Cannot reliably generate clients or validators.
- Drift is difficult to detect.
- Contradicts the requirement that OpenAPI remain synchronized.

### Option B: OpenAPI is authoritative; remove rules it cannot express

Advantages:

- Single machine-readable contract.

Disadvantages:

- Weakens important domain validation.
- Some cross-field and state rules are not naturally represented by basic schema keywords.

### Option C: OpenAPI is the authoritative HTTP shape, with named semantic constraints

OpenAPI defines every route, parameter, header, request/response schema, status, and structural constraint. Cross-field or stateful rules that cannot be expressed portably are named in OpenAPI descriptions and mapped one-to-one to executable validation rules and contract tests.

Advantages:

- Machine-readable shapes remain authoritative.
- Semantic rules remain explicit and testable.
- Client generation is predictable.
- Drift can fail CI.

Disadvantages:

- Requires disciplined schema reuse and tooling.
- Some rules need both descriptions and tests.
- OpenAPI changes require review as public contract changes.

## Recommended decision

Adopt **Option C**.

Minimum rules:

1. OpenAPI 3.1 is the authoritative public HTTP shape after approval.
2. Every operation declares its successful statuses and applicable 400, 401, 403, 404, 409, 422, 429, 500, and 503 responses explicitly.
3. Every response uses the standard `{ success, data, metadata }` envelope except `204 No Content`, which has no body and is the only normal success response without an envelope.
4. Paginated responses place `nextCursor`, `hasMore`, and `limit` inside `metadata`: `{ success, data, metadata: { nextCursor, hasMore, limit } }`. This resolves the alternate top-level pagination example in favor of the general envelope.
5. The request identifier header is `X-Request-ID`. W3C trace propagation uses required `traceparent` when a trace is propagated and optional `tracestate`.
6. Rate-limit responses use `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset`; `429 Too Many Requests` also uses `Retry-After`.
7. Idempotency key where applicable and deprecation headers are defined as reusable components.
8. Conditional DTO rules use JSON Schema `oneOf`, `dependentRequired`, and documented semantic constraints where supported.
9. Each non-schema state rule receives a stable validation-rule code used by implementation and tests.
10. Generic response objects such as journal reflections and media references are prohibited; every public object is fully typed.
11. Public and internal APIs are separate OpenAPI documents or clearly separate, non-public server surfaces.
12. CI validates OpenAPI syntax, breaking changes, examples, DTO parity, and generated-client compilation.

The API specification remains the source of endpoint scope; OpenAPI cannot introduce a new public route without an approved specification change.

## Consequences

### Positive

- Public API behavior becomes unambiguous.
- Client and server contracts can be generated and tested.
- Documentation drift becomes detectable.
- Validation and error behavior become consistent.

### Negative

- More detailed OpenAPI maintenance is required.
- Breaking-contract review becomes mandatory.
- Some semantic validation still needs executable tests.

### Required follow-up specifications

- Standard header definitions.
- Explicit per-operation error matrix.
- Validation-rule code registry.
- Complete reflection and media-reference DTOs.
- Conditional field rules for journals and plans.
- OpenAPI lint and compatibility policy.

## Affected services

- API Gateway
- Memory Service
- Planning Service
- Navigation Service
- Recommendation Service
- Documentation Service
- Notification Service
- Search Service

## Affected documents

- `docs/api/m2/openapi.yaml`
- Every Markdown file under `docs/api/m2/`
- `API_SPEC.md`
- `SERVICE_ARCHITECTURE.md`
- `SYSTEM_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `MEMORY_ARCHITECTURE.md`
- `PRODUCT_SPEC.md`
- `AI_PIPELINE.md`
