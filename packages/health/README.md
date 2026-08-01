# @guided-discovery/health

Reusable liveness, readiness, version, dependency-check, timeout, aggregation, and health-metric behavior.

Liveness never calls dependencies. Readiness evaluates registered checks concurrently, bounds each check, converts failures into stable content-free codes, and reports `DOWN` if any required dependency is unavailable. No endpoint framework or application dependency is embedded.
