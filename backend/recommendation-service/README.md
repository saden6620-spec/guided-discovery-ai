# Recommendation Service

M2.5 Recommendation-owned persistence and lifecycle service. It stores completed recommendations supplied by authorized deterministic internal producers; it does not generate, rank, personalize, or call AI or external providers.

## HTTP contracts

- `GET /api/v1/recommendations`
- `POST /api/v1/recommendations/{id}/accept`
- `POST /api/v1/recommendations/{id}/dismiss`
- `POST /internal/v1/recommendations` (workload authentication and `recommendation.ingest` required)
- `/health`, `/health/live`, `/health/ready`, `/health/version`

The private command resolves `permissionPolicyRef` and the authoritative `permissionVersion` through Permission Service before insertion. Permission details, provenance, and encrypted rationale are not logged or returned as authorization data. M2.5 stores only scalar score factors, including `SAFETY` and `ACCESSIBILITY`; structured attributes are deferred.

## Configuration

Required runtime settings are `RECOMMENDATION_DATABASE_URL`, `RECOMMENDATION_ENCRYPTION_KEY`, `PERMISSION_SERVICE_URL`, `SERVICE_AUTH_TOKEN`, and `CURSOR_SIGNING_KEY`. Test-only permission bypass requires both `APP_ENV=test` and `PERMISSION_TEST_ALLOW=true`.

## Persistence and events

The service owns `recommendations`, `recommendation_scores`, append-only `recommendation_history`, transactional `outbox_events`, `inbox_events`, `dead_letter_events`, and `idempotency_records`. It publishes only `RecommendationAccepted`, `RecommendationDismissed`, and `RecommendationExpired`; no broker adapter is included.

Apply migrations with `pnpm --filter @guided-discovery/recommendation-service migrate:deploy`. The reviewed `down.sql` is for empty/test reversal validation; production rollback follows ADR-0009 forward compensation.

## Validation

Run `build`, `typecheck`, `lint`, `test`, `prisma:validate`, and the repository-wide validation commands from the root.
