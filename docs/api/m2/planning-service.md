# Planning Service Contract

Status: Final

Planning Service owns itineraries, itinerary items, reservations, and travel checklists. It does not generate plans, call providers, own routes, or evaluate AI inputs.

Public routes are `GET/POST /plans` and `PATCH/DELETE /plans/{id}`. Plan states are `DRAFT`, `ACCEPTED`, `COMPLETED`, and `CANCELLED`; terminal states cannot transition. Creation may atomically include children. PATCH uses stable ID-based create/update/delete operation arrays from `openapi.yaml`; it never replaces child collections implicitly. The parent version and all referenced child versions are checked before a single atomic commit.

Plan title, dates, budget pair, child limits, temporal ordering, stable positions, idempotency, errors, deletion, retention, entities, and events are fully defined by the common, validation, database, OpenAPI, and AsyncAPI contracts.
