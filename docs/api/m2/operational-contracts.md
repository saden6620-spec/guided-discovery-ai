# M2 Operational Contracts

Status: Final

## Migration tooling and ownership

- TypeScript/PostgreSQL services use Prisma Migrate with one schema and migration history per service. SQL migrations are committed under the owning service and reviewed as generated plus hand-audited SQL.
- OpenSearch mappings use versioned JSON templates and aliases owned by Search Service.
- Redis/BullMQ has no schema migration; queue name and job schema versions are deployed compatibly before producers.
- Development validates apply, lossless down where supplied, and reapply. Production never runs automatic down migrations.
- Production follows expand-and-contract: additive expansion, dual-compatible deployment, idempotent checkpointed backfill, read switch, write switch, observation window of at least one successful release, then separately approved contraction.
- Destructive migration requires backup/restore evidence, purge and legal-hold review, affected-data estimate, compensating migration/runbook, and explicit operator approval.
- CI creates an empty database, applies all migrations, validates schema, applies from the previous release snapshot, runs compatibility tests, and checks migration ownership. Search CI builds a new physical index and atomically swaps an alias in an isolated environment.

## Backup restore runbook contract

Restore is permitted only into an isolated environment. The operator records restore ID, backup set, snapshot time, initiator, approver, target, and reason code. The process is: block all normal traffic and workers; restore encryption/key references; restore the latest deletion ledger and legal-hold records first; restore service databases; replay deletion and permission changes newer than the snapshot; purge or quarantine every record whose current deletion version dominates the restored version; rebuild Search from authorized source exports/events; validate counts, schema versions, tombstones, permissions, and sampled deletion barriers; rotate restored credentials; obtain two-person approval; then enable traffic. Any missing ledger, key, migration, or validation evidence aborts the restore. Quarterly test restores verify that a fixture deleted after the snapshot is not readable, searchable, emitted, analyzed, or reindexed.

## Queue contracts

Queue names are `<environment>.<service>.<purpose>.v<major>`. M2 defines:

- `*.event-bus.publish.v1`: outbox publication.
- `*.notification.schedule.v1`: move due notifications to `QUEUED`.
- `*.memory.purge.v1`: distributed memory purge coordination.
- `*.retention.purge.v1`: non-memory purge.
- `*.search.reindex.v1`: versioned reindex jobs.

Every job has `jobId` UUID, `jobType`, `jobVersion`, `subjectId`, `subjectVersion`, `correlationId`, `attempt`, `notBefore`, and minimal payload. Job ID is the deduplication ID. Processing is at least once and must be idempotent.

Retry policy: attempts at 1, 5, 30, 120, and 600 seconds with up to 20% jitter; five failed processing attempts move the job to the service dead-letter queue. Authorization denials, schema incompatibility, stale versions, and invalid transitions are non-retryable. Dependency timeout, connection reset, broker unavailability, and lock contention are retryable. Dead letters trigger an alert within five minutes and retain under `O3_FAILURE`.

## Audit contract

Audit records contain `auditId`, `occurredAt`, `service`, `environment`, `actorType`, pseudonymous `actorRef`, `action`, `resourceType`, pseudonymous `resourceRef`, `decision` (`SUCCEEDED|DENIED|FAILED`), `reasonCode`, `requestId`, `traceId`, `permissionDecisionId` where applicable, and `metadataClassification`. They never contain tokens, raw search queries, memory/journal/notification content, coordinates, raw addresses, request/response bodies, or cryptographic material.

Audited actions include authentication boundary outcomes, protected reads/writes/deletes, permission changes and checks, legal-hold changes, purge completion/failure, migration execution, dead-letter replay, reindex alias swaps, and configuration changes. Audit writes are append-only. A domain write is not rolled back solely because the remote audit sink is unavailable; a local transactional audit/outbox record is mandatory and failure to persist it aborts the command.

## Configuration contract

Configuration precedence is environment variable, mounted non-secret configuration file, then secret-manager reference. Startup rejects missing, unknown critical, malformed, or insecure production configuration. Secrets are never accepted in ordinary config files or exposed by health endpoints.

Required common variables:

| Variable                      | Rule                                                     |
| ----------------------------- | -------------------------------------------------------- |
| `APP_ENV`                     | `development                                             | test | staging | production`                       |
| `SERVICE_NAME`                | Registered service name                                  |
| `PORT`                        | 1–65535                                                  |
| `LOG_LEVEL`                   | `debug                                                   | info | warn    | error`; production minimum `info` |
| `DATABASE_URL`                | Secret reference or URI; required for stateful services  |
| `REDIS_URL`                   | Secret reference or URI; required for queues/cache       |
| `EVENT_BUS_URL`               | Secret reference or URI                                  |
| `PERMISSION_SERVICE_URL`      | HTTPS in production                                      |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | HTTPS in production                                      |
| `ENCRYPTION_KEY_REF`          | Opaque key-manager reference for content-owning services |
| `RETENTION_POLICY_CONFIG`     | Versioned policy document reference                      |

Search additionally requires `OPENSEARCH_URL`, index prefix, ranking profile version, cursor-signing key reference, and 15-minute cursor TTL. Object-storage references are configured only where a service needs them; Documentation stores media references and does not receive storage credentials.

Configuration is validated once at startup and represented as immutable typed values. Dynamic retention changes may only shorten a value within ADR-0008 maxima; increases require architecture approval. Every active configuration exposes a non-secret version fingerprint to diagnostics.

Retention configuration is a signed versioned document containing `policyVersion`, `effectiveAt`, and a map from every ADR-0008 class to integer seconds. It must include all classes, may not exceed ADR maxima, and cannot change the semantic class assigned to an entity. Services retain the active and immediately previous policy version through the compatibility window. A shorter duration schedules newly overdue records immediately; a longer value within an approved maximum affects only records not already due for purge.

## Health contracts

Every service exposes unauthenticated `/health/live` and `/health/ready` outside `/api/v1` and authenticated internal `/health/details`.

- Liveness returns 200 when the process event loop is responsive; it does not call dependencies.
- Readiness returns 200 only when configuration is valid, migrations match the supported schema, required database/queue connections work, and required synchronous authorities are reachable. It returns 503 otherwise.
- Details include service name/version, status, config fingerprint, and dependency statuses with latency and stable error codes; never endpoints, credentials, database names, queue payloads, or user data.
- Health response budget is 500 ms. Dependency probes use 200 ms timeout and no more than one retry.

Health envelope data is `{ status: "UP"|"DOWN", service, version, checks?, timestamp }` with the standard metadata. Kubernetes is not implemented in M2; these contracts are platform-neutral.

## Metrics contract

Prometheus-compatible metrics use stable snake_case names prefixed `gda_`. Required metrics:

- `gda_http_requests_total{service,method,route,status_class}`.
- `gda_http_request_duration_seconds{service,method,route}` histogram.
- `gda_dependency_requests_total{service,dependency,outcome}` and duration histogram.
- `gda_outbox_pending`, `gda_outbox_publish_total{outcome}`, `gda_inbox_process_total{event_type,outcome}`.
- `gda_queue_depth{service,queue}`, `gda_queue_job_total{queue,outcome}`, `gda_dead_letter_total{queue}`.
- `gda_permission_check_total{action,decision}` and duration histogram.
- `gda_purge_pending{service,class}`, `gda_purge_total{service,outcome}`.
- `gda_search_requests_total{availability}`, Search latency, and index-document count; no query labels.

Labels must have bounded cardinality. User IDs, resource IDs, request IDs, trace IDs, search text, URLs with identifiers, and error messages are forbidden labels.

## Tracing and logging

W3C `traceparent` and optional `tracestate` propagate across HTTP, events, and jobs. Invalid inbound trace context starts a new trace and records a safe validation flag. `X-Request-ID` is accepted only when 1–128 printable ASCII characters; otherwise generated. The gateway returns the effective ID.

Structured JSON logs contain timestamp, severity, service, environment, event code, request ID, trace/span IDs, route template, status, duration, and safe error code. Logs redact authorization, cookies, secrets, content, query strings, coordinates, addresses, and payloads. Sampling may reduce successful diagnostic traces but never audit records, errors, permission denials, deletion, or purge traces.

## Service discovery and dependency failure

Service locations come from configuration/service discovery, never hardcoded addresses. HTTP clients use connect timeout 500 ms, total timeout 2 seconds unless the contract is stricter, bounded retry only for idempotent transient failures, exponential backoff, and circuit breaking. Permission checks use their stricter 250 ms timeout and fail closed. No automatic retry is permitted for a non-idempotent request lacking an idempotency key.

## Rate limits

Gateway limits are configurable by authenticated principal and route class. Initial M2 defaults are 120 reads/minute, 60 writes/minute, 30 Search requests/minute, and 600 internal requests/minute per workload identity. A response reports `RateLimit-Limit`, `RateLimit-Remaining`, and epoch-second `RateLimit-Reset`; 429 also reports integer-seconds `Retry-After`. Rate limiting happens after authentication and before body-dependent business processing.
