# Planning Service

M2.3 implementation of the Planning-owned itinerary aggregate. The service owns plans, itinerary items, reservations, and travel checklists. It does not generate plans, call travel providers, own navigation routes, or implement recommendations.

## Public API

- `GET /api/v1/plans` — cursor-paginated owner plans with status and date filters.
- `POST /api/v1/plans` — atomically creates a draft plan and optional children; requires `Idempotency-Key`.
- `PATCH /api/v1/plans/{id}` — atomically changes scalar fields and stable-ID child operation arrays using optimistic concurrency.
- `DELETE /api/v1/plans/{id}` — immediately removes an owned plan and its children from normal reads and schedules bounded purge retention.

No unapproved child-resource or internal endpoint is exposed. Health endpoints are `/health/live`, `/health/ready`, and the compatibility `/health` probe.

## Persistence and events

Planning uses its own PostgreSQL database. Protected notes and reservation references are AES-256-GCM encrypted by the application adapter. The initial Prisma-owned migration creates the aggregate tables, partial active indexes, constraints, transactional outbox, inbox/dead-letter foundation, and idempotency records. Commands append the versioned `PlanChanged` event in the same transaction as state changes; broker publication is intentionally outside M2.3.

## Local validation

Set `PLANNING_DATABASE_URL`, `APP_ENV=test`, and `PERMISSION_TEST_ALLOW=true`, then run:

```text
pnpm --filter @guided-discovery/planning-service prisma:validate
pnpm --filter @guided-discovery/planning-service migrate:deploy
pnpm --filter @guided-discovery/planning-service build
pnpm --filter @guided-discovery/planning-service test
```

The migration directory also contains an explicit `down.sql` used only in isolated migration validation. Production follows forward-only expand-and-contract rules.
