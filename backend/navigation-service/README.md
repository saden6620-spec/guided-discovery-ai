# Navigation Service

M2.4 provider-neutral Navigation Service. It owns destinations, routes, trips, navigation sessions, visited locations, landmarks, and its reliability records.

Public endpoints are `/api/v1/navigation/start`, `/stop`, `/status`, and `/reroute`. Private provisioning is limited to `PUT /internal/v1/destinations/{destinationId}` and `PUT /internal/v1/routes/{routeId}`. M2.4 never calls a map provider or computes routes.

Only `ACTIVE`, `COMPLETED`, and `CANCELLED` are implemented. Every session has a non-null Trip. Pause, resume, replacement, navigation-only sessions, GPS tracking, route generation, and external providers are deferred.

Configuration: `NAVIGATION_DATABASE_URL` (or `DATABASE_URL`), `NAVIGATION_ENCRYPTION_KEY`, `PERMISSION_SERVICE_URL`, `SERVICE_AUTH_TOKEN`, `SERVICE_PORT`, `APP_ENV`, and test-only `PERMISSION_TEST_ALLOW`. Precise route geometry is encrypted and never written to ordinary logs.

Commands: `pnpm --filter @guided-discovery/navigation-service build|lint|typecheck|test|prisma:validate|migrate:deploy|openapi:generate`.
