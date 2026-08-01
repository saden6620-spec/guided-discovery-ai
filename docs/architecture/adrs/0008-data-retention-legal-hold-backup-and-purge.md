# ADR-0008: Data Retention, Legal Hold, Backup, and Purge

- Status: Accepted
- Date: 2026-08-01
- Decision scope: M2 primary, derived, operational, and backup data

## Context

The product gives users control over their data and requires immediate exclusion of deleted memories. The database architecture permits temporary retention for limited purposes and says other user-owned content follows its own retention policy. M2 needs consistent retention rules without assuming country-specific legal obligations.

## Problem

The draft specifications do not define retention authority, default classes, purge timing, legal holds, backup behavior, restore filtering, or operational-record retention for most M2 entities. Indefinite retention would violate data minimization, while immediate physical erasure of every operational record can break reliability and auditability.

## Decision drivers

- Privacy by default and minimum necessary retention.
- Immediate removal from normal behavior after user deletion.
- No invented jurisdiction-specific legal requirement.
- Configurable values with privacy-preserving defaults and bounded maxima.
- Reliable event deduplication, disaster recovery, and auditability.
- No resurrection from replicas, backups, replay, or delayed events.
- Service ownership of retention execution.

## Viable options

### Option A: Indefinite retention until manually configured

Tradeoffs:

- Operationally simple.
- Violates minimization and user-control principles.
- Increases breach and restoration risk.

### Option B: Immediate physical deletion everywhere

Tradeoffs:

- Strong minimization.
- Impractical for encrypted rolling backups and distributed consumers.
- Prevents rollback-safe processing and event deduplication.

### Option C: Classified retention with immediate logical deletion and bounded physical purge

Each entity receives a retention class. User deletion immediately removes it from normal behavior. Physical purge occurs within a bounded class-specific window unless an explicit legal hold applies. Backups expire on a short rolling schedule and apply deletion barriers on restore.

Tradeoffs:

- Balances privacy, recoverability, and distributed cleanup.
- Requires policy metadata, purge jobs, and monitoring.
- Values require periodic review.

## Tradeoff analysis

Uniform indefinite retention is operationally easy but conflicts with data minimization. Immediate physical deletion cannot safely cover replicas, distributed consumers, legal holds, and rollback-safe processing. Purpose-based bounded classes provide the smallest consistent policy: immediate logical removal, minimal temporary operational retention, and auditable purge across every storage tier.

## Recommended decision

Adopt **Option C**.

## Detailed rules

### Retention authority

1. The user controls deletion and optional shorter retention for user-owned content where the product exposes that control.
2. Each owning service enforces the approved policy and purge.
3. Platform security/operations may configure a shorter duration but cannot exceed the maximum in this ADR without a new approved decision.
4. Permission Service authorizes protected deletion requests but does not own domain purge execution.
5. A legal hold may override physical purge only when recorded by an authorized legal/operations principal; it never restores normal visibility.
6. No country-specific legal duration is assumed.

### Retention classes

| Class            | Purpose                                                       |                                                     Default |                          Maximum without new ADR |
| ---------------- | ------------------------------------------------------------- | ----------------------------------------------------------: | -----------------------------------------------: |
| `U0_ACTIVE`      | User-owned active data                                        |                     Until user deletion or account deletion | Not time-limited while actively retained by user |
| `U1_DELETED`     | Soft-deleted user data for distributed/rollback-safe deletion |                                                      7 days |                                          30 days |
| `D0_DERIVED`     | Search/index/cache derivative after source deletion           | Logical removal immediately; physical purge within 24 hours |                                         72 hours |
| `O1_TRANSIENT`   | Short-lived processing/queue state                            |                             24 hours after terminal success |                                           7 days |
| `O2_RELIABILITY` | Outbox/inbox deduplication                                    |                                                     30 days |                                          90 days |
| `O3_FAILURE`     | Dead-letter failure evidence                                  |                                                     30 days |                                          90 days |
| `S1_AUDIT`       | Minimal security/audit events                                 |                                                     90 days |                                         365 days |
| `A0_AGGREGATE`   | Consent-approved, non-query-content aggregate metrics         |                                                     30 days |                                          90 days |
| `T1_TOMBSTONE`   | Content-free anti-resurrection tombstone                      |                               90 days after confirmed purge |                                         365 days |
| `B1_BACKUP`      | Encrypted rolling backup                                      |                                                     30 days |                                          90 days |

Durations are configurable downward. Extending a maximum requires a new ADR or an explicit legal hold for identified records.

### Entity retention matrix

| Entity category                                                          | Active class                                                | Deletion behavior                                                                           | Purge timing                                           |
| ------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Plans, itinerary items, reservations, checklists                         | `U0_ACTIVE`                                                 | Immediate exclusion; `U1_DELETED` tombstoned aggregate                                      | Default 7 days, maximum 30                             |
| Trips, navigation sessions, routes created for a user, visited locations | `U0_ACTIVE`                                                 | Immediate exclusion; precise location encrypted during `U1_DELETED`                         | Default 7 days, maximum 30                             |
| Shared/provider destinations and landmarks                               | Service reference data, not user deletion                   | Remove when provider/license/operations policy requires; user associations purge separately | Configured source policy; must contain no user history |
| Journals, entries, reflections, media references                         | `U0_ACTIVE`                                                 | Immediate exclusion; references do not preserve media access                                | Default 7 days, maximum 30                             |
| Recommendations and recommendation history                               | `U0_ACTIVE`                                                 | Immediate exclusion from user behavior and later personalization                            | Default 7 days, maximum 30                             |
| Notifications                                                            | `U0_ACTIVE` until deletion or account deletion              | Immediate exclusion                                                                         | Default 7 days, maximum 30                             |
| Notification history                                                     | `S1_AUDIT` with content removed after notification deletion | Retain only IDs, state, timestamps, and error code                                          | Default 90 days, maximum 365                           |
| Search index documents                                                   | `D0_DERIVED`                                                | Deletion barrier immediately; physical index purge                                          | Within 24 hours, maximum 72                            |
| Raw search logs or query hashes                                          | No retention permitted                                      | Never persisted                                                                             | Not applicable                                         |
| Consent-approved aggregate search metrics                                | `A0_AGGREGATE`                                              | No raw query, user ID, IP, source IDs, or reversible query derivative                       | Default 30 days, maximum 90                            |
| Audit logs                                                               | `S1_AUDIT`                                                  | Content-minimized; deletion event remains without deleted content                           | Default 90 days, maximum 365                           |
| Outbox records                                                           | `O2_RELIABILITY` after successful publication               | Payload redacted when source purge requires it                                              | Default 30 days, maximum 90                            |
| Inbox/deduplication records                                              | `O2_RELIABILITY`                                            | Store event ID, consumer, subject/version, and timestamp only                               | Default 30 days, maximum 90                            |
| Dead-letter events                                                       | `O3_FAILURE`                                                | Encrypt; redact prohibited content; purge after resolution/window                           | Default 30 days, maximum 90                            |
| Memory tombstones                                                        | `T1_TOMBSTONE`                                              | Content-free and unavailable to normal behavior                                             | Default 90 days after purge, maximum 365               |

Memory content retention and deletion follow ADR-0002 and ADR-0011. If their guarantees are stricter, the stricter rule wins.

### Legal hold

1. A hold records hold ID, authority reference, reason category, creation time, optional expiry, affected resource IDs, and actor ID.
2. Free-form legal narrative and protected content are not duplicated into the hold record.
3. Held data remains excluded from user-visible, Search, AI, recommendation, personalization, analytics, and normal application behavior after deletion.
4. Hold access is least-privilege, audited, and separate from normal repositories.
5. Expired or released holds immediately return records to their purge workflow.
6. Users receive transparency where permitted, but this ADR does not invent legal notification rules.

### Replicas and caches

- Logical deletion applies to primary and replicas through the same committed state/version.
- Read replicas must not serve data behind the required deletion barrier.
- Caches are invalidated immediately and always enforce deletion/permission versions on read.
- A cache entry without current authorization/deletion metadata is treated as unavailable.

### Backups

1. Backups are encrypted, access-controlled, immutable during their retention window, and expire under `B1_BACKUP`.
2. Individual in-place deletion from immutable backup media is not required when technically impractical, but expired backup sets must be destroyed.
3. The live deletion ledger/tombstone is backed up separately and restored before user/domain data becomes readable.
4. A restore must replay deletion barriers and purge all records deleted after the backup snapshot before opening normal service traffic.
5. Restored outbox events cannot resurrect deleted data; consumers enforce deletion versions.
6. Backup restoration is audited and tested.

### Auditability

Every retention action records resource type, opaque resource ID, policy class/version, action, timestamp, actor or worker identity, legal-hold ID when applicable, and result. It must not copy deleted content.

## Consequences

### Positive

- User deletion has immediate effect across normal behavior.
- Sensitive and query-derived data receive minimal retention.
- Operational reliability retains only bounded metadata.
- Restores cannot silently resurrect deleted resources.

### Negative

- Purge and policy-monitoring infrastructure is required.
- Short retention reduces forensic history.
- Backup restoration becomes a gated multi-step process.
- Operators must monitor deadlines and legal holds.

## Security and privacy impact

- Raw queries and query hashes are prohibited.
- Precise location and held sensitive data remain encrypted.
- Audit and reliability records are content-minimized.
- Legal hold prevents physical purge but never restores product access.

## Failure behavior

- A failed logical deletion fails the request; no success is returned.
- A failed physical purge is retried, alerted, and remains hidden behind the deletion barrier.
- If policy metadata is unavailable, protected deleted data remains unavailable.
- Restore validation failure prevents normal traffic from starting.

## M2 scope

- Policy fields, deletion timestamps, purge scheduling, content-free audit records, and M2 entity purge workers.
- Search-index deletion deadlines.
- Outbox/inbox/dead-letter retention.
- Backup restore barrier specification and test foundation.

## Deferred scope

- Country-specific statutory schedules.
- Production backup-provider implementation.
- Long-term vector, graph, embedding, and AI-derived record purge implementations.
- User-facing retention controls not already in the product specification.

## Affected services

- All M2 services
- Permission Service
- Analytics Service
- Media Service for referenced media deletion coordination
- Infrastructure backup and database components
- Future AI, vector, graph, and personalization consumers

## Affected documents

- Every specification under `docs/api/m2/`
- ADR-0001, ADR-0002, ADR-0005, ADR-0006, ADR-0010, ADR-0011
- `DATABASE_SCHEMA.md`
- `MEMORY_ARCHITECTURE.md`
- `PRODUCT_SPEC.md`
- `SYSTEM_ARCHITECTURE.md`
- `SERVICE_ARCHITECTURE.md`
- `API_SPEC.md`
- `AI_PIPELINE.md`

## Required follow-up specifications

- Per-entity policy columns and indexes.
- Purge-worker commands and metrics.
- Legal-hold authorization contract.
- Backup restore runbook and validation tests.
- Retention configuration schema and policy-version migration.
- Audit event schema.

## Acceptance criteria

- Every listed M2 entity maps to one retention class.
- User deletion removes data from normal behavior immediately.
- No raw query or query hash is retained.
- Physical purge deadlines are bounded and monitored.
- Legal holds never restore normal visibility.
- Restores apply current deletion barriers before serving traffic.
- Retention maxima cannot be extended through ordinary configuration.
- Records contain only the minimum data required for their approved retention purpose.
