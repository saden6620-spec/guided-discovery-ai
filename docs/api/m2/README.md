# M2 Core Backend Implementation Specifications

Status: Final

ADR-0001 through ADR-0011 are approved and authoritative. This directory is the complete implementation contract for M2 domain services. It authorizes no implementation by itself and does not modify milestone control.

## Machine-readable contracts

- `openapi.yaml`: complete public `/api/v1` HTTP API.
- `internal-openapi.yaml`: private workload-authenticated commands and queries.
- `asyncapi.yaml`: domain-event topics, producers, consumers, payloads, ordering, retry, dead-letter, and compatibility.

## Normative specifications

- `common-contracts.md`: envelopes, headers, pagination, identifiers, authorization, errors, and precedence.
- `internal-service-contracts.md`: Permission, navigation provisioning, recommendation ingestion, notification scheduling, memory categories, and Search producers.
- `database-entities.md`: entities, ownership, relationships, constraints, indexes, versioning, deletion, and retention.
- `validation-specification.md`: field, business, lifecycle, idempotency, concurrency, and conflict rules.
- `operational-contracts.md`: migrations, queues, audit, configuration, health, metrics, logging, and tracing.
- Service documents define service ownership, API surface, lifecycle, and exclusions.

## Precedence

Approved ADRs take precedence over earlier architecture examples. Within this specification set, machine-readable schemas govern HTTP/event wire shapes; validation rules govern cross-field and stateful behavior; database specifications govern persistence; service documents govern ownership. Any future conflict must stop implementation and be resolved through an ADR or versioned specification amendment.

## M2 exclusions

M2 contains no AI reasoning, memory embeddings or semantic selection, route generation, recommendation generation/ranking, real notification delivery provider, authentication business rules, community, learning, plugin runtime, or user-facing feature implementation.
