# @guided-discovery/validation

Reusable Zod schemas and request/response helpers for canonical UUIDs, UTC timestamps, pagination, opaque cursors, request IDs, trace context, and optimistic versions.

Request failures become field-level `ValidationException` values with JSON Pointer paths. Response validation fails internally and does not expose response content.
