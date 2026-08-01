# @guided-discovery/shared-config

Strict, startup-time configuration loading with Zod validation, environment-specific safe defaults, typed namespaces, duplicate detection, and deeply immutable results.

Common variables are `APP_ENV`, `SERVICE_NAME`, `SERVICE_VERSION`, `PORT`/`SERVICE_PORT`, and `LOG_LEVEL`. Services add application-specific values only through an explicitly defined namespace; this package itself contains none. Invalid configuration throws before service startup.
