# Memory Service

The M2.2 Memory Service owns explicit user memories, immutable versions, system memory categories, stable memory links, and the deletion ledger. It does not implement inferred memories, embeddings, vector or semantic search, AI selection, ranking, recommendations, or personalization.

## HTTP contracts

- `GET /api/v1/memories`
- `GET /api/v1/memories/{id}`
- `POST /api/v1/memories`
- `PATCH /api/v1/memories/{id}`
- `DELETE /api/v1/memories/{id}`
- `GET /internal/v1/memory-categories`
- `GET /health`, `/health/live`, `/health/ready`, and `/health/version`

The generated Memory Service contract is committed at `openapi/memory-service.openapi.json`. The approved source remains `docs/api/m2/openapi.yaml`.

## Persistence and deletion

PostgreSQL stores encrypted memory content and immutable versions. `memory_deletion_ledger` is the only physical deletion-tombstone persistence. A delete transaction makes content immediately unavailable, removes active links, writes the ledger barrier, and records `MemoryDeletionRequired` in the transactional outbox. Repeated owner-authorized deletion is idempotent and returns `204 No Content`.

No message broker is implemented in M2.2. Outbox, inbox, and dead-letter persistence provide the approved reliable-event boundary for a later broker adapter.

## Local commands

Set `DATABASE_URL`, apply migrations with `pnpm --filter @guided-discovery/memory-service migrate:deploy`, then use the workspace build, lint, typecheck, and test commands. Integration tests require `APP_ENV=test` and `PERMISSION_TEST_ALLOW=true`; these test-only switches are rejected as authentication behavior outside the test environment.

Production authentication is deliberately not implemented in this milestone. The service exposes a principal-provider boundary and delegates protected-data authorization to Permission Service.
