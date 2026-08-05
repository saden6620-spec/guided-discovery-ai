# Documentation Service

M2.6 owner-private journal service. It owns journals, text/reference entries, reflections, opaque media references, derived timeline ordering, retention metadata, legal holds, idempotency, and transactional event persistence.

## Boundaries

The service never accepts media binaries, paths, download URLs, storage credentials, device permissions, sharing commands, or AI analysis. Media Service identifiers are opaque and do not grant access. Permission Service remains authoritative; journal policy references are resolved server-side and never exposed publicly.

## API

- `GET /api/v1/journals`
- `POST /api/v1/journals`
- `PATCH /api/v1/journals/{id}`
- `DELETE /api/v1/journals/{id}`
- `/health`, `/health/live`, `/health/ready`, `/health/version`

POST embeds TEXT entries only. PATCH processes media operations, entry operations, then reflection operations atomically. Children retain stable IDs, explicit deletion, optimistic versions, unique positions, and deterministic compaction.

## Configuration

- `DOCUMENTATION_DATABASE_URL`
- `DOCUMENTATION_ENCRYPTION_KEY`
- `PERMISSION_SERVICE_URL`
- `SERVICE_AUTH_TOKEN`
- `SERVICE_PORT` (default `3008`)

## Development

Run migrations with `pnpm --filter @guided-discovery/documentation-service migrate:deploy`, then build/test with the normal root validation commands. The service publishes only `JournalChanged` through its transactional outbox; no external broker adapter is included.
