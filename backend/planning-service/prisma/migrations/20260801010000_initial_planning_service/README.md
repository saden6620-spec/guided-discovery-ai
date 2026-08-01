# Initial Planning Service migration

Creates the Planning-owned itinerary aggregate, child resources, transactional outbox, inbox/dead-letter foundations, and command idempotency records. `down.sql` is lossless for an empty validation database and is never run automatically in production.
