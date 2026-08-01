# Architecture Decision Records

This directory contains accepted architecture decisions for the Guided Discovery AI platform.

ADR-0001 through ADR-0011 were approved on 2026-08-01 and are authoritative for M2. Implementation still requires separate milestone authorization.

## M2 accepted decisions

| ADR                                                                   | Decision                                                       | Status   | Resolved architectural issue                                                |
| --------------------------------------------------------------------- | -------------------------------------------------------------- | -------- | --------------------------------------------------------------------------- |
| [ADR-0001](0001-authoritative-permission-projection.md)               | Authoritative permission checks and protected-data projections | Accepted | Domain and Search services cannot safely authorize protected data           |
| [ADR-0002](0002-immediate-distributed-deletion.md)                    | Immediate distributed deletion barrier                         | Accepted | Asynchronous cleanup cannot guarantee immediate memory invisibility         |
| [ADR-0003](0003-internal-resource-ingestion-contracts.md)             | Internal resource-ingestion contracts                          | Accepted | Several M2 APIs expose resources that have no creation path                 |
| [ADR-0004](0004-openapi-contract-parity.md)                           | OpenAPI as the complete HTTP contract                          | Accepted | Machine-readable definitions do not enforce the written DTO rules           |
| [ADR-0005](0005-stable-child-resource-mutations.md)                   | Stable child-resource mutation semantics                       | Accepted | Parent PATCH replacement would destroy child identity and history           |
| [ADR-0006](0006-reliable-domain-event-contract.md)                    | Reliable domain-event contract                                 | Accepted | Event schemas lack delivery, ordering, deduplication, and publication rules |
| [ADR-0007](0007-domain-lifecycle-and-disposition.md)                  | Domain lifecycle and disposition                               | Accepted | Navigation, recommendation, and notification transitions are undefined      |
| [ADR-0008](0008-data-retention-legal-hold-backup-and-purge.md)        | Data retention, legal hold, backup, and purge                  | Accepted | Non-memory retention and recovery-safe purge rules are undefined            |
| [ADR-0009](0009-database-migration-reversibility.md)                  | Database migration reversibility                               | Accepted | Rollback-safe migration behavior is ambiguous                               |
| [ADR-0010](0010-search-privacy-ranking-availability-and-analytics.md) | Search privacy, ranking, availability, and analytics           | Accepted | Search privacy, ranking, availability, and producer rules are incomplete    |
| [ADR-0011](0011-memory-record-semantics.md)                           | Memory record semantics                                        | Accepted | The canonical memory aggregate and metadata semantics are undefined         |

## Approval order

The recommended order is:

1. ADR-0001, because permission authority affects every protected resource and event.
2. ADR-0002, because deletion guarantees constrain persistence, Search, caching, and events.
3. ADR-0006, because the reliable event contract is required by ADR-0002 and ADR-0003.
4. ADR-0003, because service APIs cannot be functional without resource-ingestion paths.
5. ADR-0005, because stable child identity affects API and database contracts.
6. ADR-0007, which depends on ADR-0003 for private creation boundaries and ADR-0006 for lifecycle events.
7. ADR-0008, which extends ADR-0002 deletion guarantees and governs ADR-0006 operational-record retention.
8. ADR-0009, which depends on ADR-0002 and ADR-0008 for deletion-safe rollback and restoration.
9. ADR-0010, which depends on ADR-0001, ADR-0002, ADR-0003, ADR-0006, and ADR-0008 for authorization, deletion, producers, events, and analytics retention.
10. ADR-0011, which depends on ADR-0001, ADR-0002, ADR-0005, ADR-0006, and ADR-0008 for permission, deletion, stable links, events, and retention.
11. ADR-0004, after the preceding decisions establish the authoritative HTTP shapes and validation rules.

Dependency summary:

- ADR-0007 depends on ADR-0003 and ADR-0006.
- ADR-0008 depends on ADR-0002 and constrains ADR-0006.
- ADR-0009 depends on ADR-0002 and ADR-0008.
- ADR-0010 depends on ADR-0001, ADR-0002, ADR-0003, ADR-0006, and ADR-0008.
- ADR-0011 depends on ADR-0001, ADR-0002, ADR-0005, ADR-0006, and ADR-0008.

## Source constraints

These ADRs were evaluated against:

- `PRODUCT_SPEC.md`
- `SYSTEM_ARCHITECTURE.md`
- `SERVICE_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `MEMORY_ARCHITECTURE.md`
- `API_SPEC.md`
- `AI_PIPELINE.md`

They do not modify `TASKS.md`, `DEVELOPMENT_ROADMAP.md`, or implementation files.
