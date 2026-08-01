# Notification Service Contract

Status: Final

Notification Service owns notification schedules, state history, and queue jobs. It does not own contact details, provider credentials, permission records, AI reminders, or emergency decisions.

Canonical states are `DRAFT`, `SCHEDULED`, `QUEUED`, `PROCESSING`, `DELIVERED`, `FAILED`, `CANCELLED`, and `EXPIRED`. M2 internal scheduling creates scheduled or queued notifications; its scheduler moves due records to queued. No production delivery or no-op adapter is included, so queued is the normal M2 terminal handoff. Draft, processing, delivered, and failed are not reached by normal M2 runtime.

Public API lists notifications, changes read/unread state, cancels scheduled notifications, and deletes owner visibility. Read state is independent of delivery but can only be marked read for delivered records; this validation remains dormant in M2. Delivered records cannot be cancelled. Internal scheduling, public DTOs, queue behavior, persistence, events, and errors are defined in the corresponding authoritative specifications.
