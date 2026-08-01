# Memory Service Contract

Status: Final

Memory Service owns memories, immutable versions, system categories, links, deletion ledger, and purge coordination. Permission Service owns authorization. Search owns indexes. M2 implements no embeddings, semantic retrieval, AI selection, merge, or inferred memories.

The public routes are `GET/POST /memories` and `GET/PATCH/DELETE /memories/{id}` exactly as defined by `openapi.yaml`. Public creation is user-explicit, requires purpose and approved system category, sets confidence 1, and assigns server-controlled permission/encryption/retention metadata. PATCH appends an immutable version for content corrections, can archive or restore through `state`, and can atomically create or delete explicit stable memory links. Correction retains the same memory ID.

States are `ACTIVE`, `ARCHIVED`, `DELETED_PENDING_PURGE`, and conceptual `PURGED`. Public M2 reaches active, archived, restored, updated, and deleted states. Owner-authorized repeated delete returns 204. Deletion immediately excludes content, versions, and links from Search, AI, recommendations, personalization, analytics, caches, and ordinary reads. Legal hold delays only physical purge.

Canonical DTOs are in OpenAPI, internal categories in `internal-service-contracts.md`, entities in `database-entities.md`, event payloads in AsyncAPI, and field/concurrency rules in `validation-specification.md`.
