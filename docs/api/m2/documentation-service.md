# Documentation Service Contract

Status: Final

Documentation Service owns journals, entries, reflections, media references, and the derived timeline. Media binaries and object-storage URLs remain owned by Media Service and are not part of M2 Documentation persistence.

Public routes are `GET/POST /journals` and `PATCH/DELETE /journals/{id}`. Resources are owner-private. Creation may include entries. PATCH uses stable ID-based operation arrays for entries, reflections, and media references; all operations and version checks commit atomically. Text entries require content and prohibit media ID; reference entries require the matching media kind and prohibit text content. Timeline order is `(occurredAt asc, position asc, id asc)` and is derived, not persisted.

Deletion immediately removes the aggregate from normal behavior and uses ADR-0008 retention. No restore, sharing, AI summary, AI reflection, upload, or media-processing behavior is in M2. Exact schemas and persistence are defined by OpenAPI, validation, database, and AsyncAPI documents.
