# ADR-0009: Database Migration Reversibility

- Status: Accepted
- Date: 2026-08-01
- Decision scope: M2 service-owned PostgreSQL and Search index migrations

## Context

The architecture requires versioned, documented, tested, rollback-safe migrations, no manual production changes, and independently deployable services. The draft common contract proposed forward-only production changes with compensating migrations, but did not fully reconcile development rollback, destructive changes, compatibility windows, failed deployments, or emergency restoration.

## Problem

Requiring every migration to have a mechanical down migration can make destructive rollback unsafe, while allowing unrestricted forward-only changes can leave deployments unrecoverable. A consistent strategy is required for schema changes, data backfills, Search mappings, and independently deployed old/new service versions.

## Decision drivers

- Preserve data and availability.
- Allow each service to migrate independently.
- Support safe application rollback.
- Avoid destructive automatic down migrations.
- Verify rollback behavior before deployment.
- Maintain compatibility during rolling deployment.
- Keep migration ownership inside each service boundary.

## Viable options

### Option A: Fully reversible down migrations

Every migration implements `up` and `down`, including destructive changes.

Tradeoffs:

- Simple developer workflow.
- A destructive down migration can lose newly written data.
- Reversal may be impossible after a semantic data transformation.

### Option B: Forward-only production migrations

Production never runs down migrations; failures are repaired by a new forward migration.

Tradeoffs:

- Avoids unsafe automatic reversal.
- Requires schema compatibility to roll application code back.
- Poorly planned changes can still block rollback.

### Option C: Hybrid expand-and-contract strategy

Development migrations provide safe down operations where lossless. Production uses forward migrations and application rollback within a compatibility window. Destructive changes occur only after old code is retired, backups are verified, and a separately reviewed contract migration is approved. Compensating migrations repair production failures.

Tradeoffs:

- Safest for independent rolling deployments.
- Requires multiple releases for breaking changes.
- Demands compatibility tests and operational discipline.

## Tradeoff analysis

Universal down migrations create a false safety guarantee once data has been transformed or deleted. Pure forward-only migration slows local development and leaves application rollback underspecified. A hybrid expand-and-contract policy permits lossless development rollback while using forward repair, compatibility windows, and controlled restoration for production data safety.

## Recommended decision

Adopt **Option C**.

## Detailed rules

### Ownership

1. Each service owns its migrations and migration-history table.
2. A service migration may modify only its owned schema/indexes.
3. Cross-service foreign keys and cross-service migration transactions are prohibited.
4. Search owns OpenSearch mapping/index migrations; source services own only event schemas and source records.

### Development rollback

- Every losslessly reversible migration provides and tests a `down` operation.
- A migration that cannot be reversed without data loss declares `down` unsupported and documents a compensating migration and restore procedure.
- Development validation runs apply, down where safe, and reapply from a clean database.
- Unsupported down migrations cannot be used as a shortcut for ordinary additive changes.

### Production rollback

- Production schema migrations are forward-applied.
- Application rollback is the first response to a failed application deployment, provided the previous version remains compatible with the expanded schema.
- Production does not automatically run destructive down migrations.
- Schema repair uses a reviewed forward compensating migration.
- Emergency database restoration is a last resort and follows ADR-0008 restore/deletion-barrier rules.

### Expand-and-contract

Breaking changes use at least these stages:

1. **Expand:** add nullable columns, new tables/indexes, or parallel structures without removing old ones.
2. **Dual compatibility:** deploy code that reads old/new and writes the approved transitional representation.
3. **Backfill:** migrate data in resumable, idempotent batches with checkpoints and metrics.
4. **Cut over:** switch reads/writes after verification.
5. **Observe:** retain the old representation for an approved compatibility window covering at least one successful deployment and rollback opportunity.
6. **Contract:** remove the old representation in a separately reviewed destructive migration.

The compatibility window is release-based, not a fixed number of days: it lasts until the new version has completed its approved verification period and the prior application version is formally retired.

### Destructive migrations

- Require an explicit destructive-change flag and human review.
- Require verified backup/restore capability.
- Require proof that no supported application version uses the removed schema.
- Require data-retention and legal-hold review under ADR-0008.
- Must not combine unrelated destructive operations.
- Table/column drops and lossy type changes occur only in the contract stage.

### Data backfills

- Are separate from schema DDL when they may be long-running.
- Are idempotent, resumable, bounded in batches, observable, and safe under concurrent writes.
- Record checkpoints without copying unnecessary sensitive content.
- Provide validation queries or checksums that do not expose protected data.
- Can be paused without making the service inconsistent.

### Search migrations

- Mapping changes create a versioned new index when incompatible in-place.
- Reindexing writes to the new index while reads remain on the prior alias.
- Cutover changes the service-owned alias atomically after validation.
- Rollback switches the alias back while the compatibility window remains open.
- Deletion barriers from ADR-0002 and ADR-0010 apply during reindexing and replay.

### Failed deployment handling

1. Stop further rollout.
2. Determine whether failure is application-only, additive-schema, backfill, or destructive.
3. Roll application code back when schema compatibility permits.
4. Pause backfills safely.
5. Apply a reviewed forward compensation for schema/data defects.
6. Restore from backup only when compensation cannot preserve correctness, then reapply deletion barriers before traffic.
7. Record the incident and migration result.

### CI requirements

- Build schema from zero using all migrations.
- Upgrade from the latest supported prior schema.
- Run safe down/reapply tests.
- Run previous and current application contract tests against the expanded schema.
- Validate backfill idempotency and resume behavior.
- Detect ownership violations and cross-service foreign keys.
- Validate Search index creation, reindex, alias cutover, and rollback.
- Fail on undocumented destructive operations.

### Audit and documentation

Every migration records ID, owning service, checksum, author, purpose, compatibility notes, reversibility classification, applied time, result, and deployment correlation ID. Sensitive row content is not logged.

## Consequences

### Positive

- Application versions can roll back safely during compatibility windows.
- Destructive changes receive additional review.
- Independent services retain ownership.
- Backfills and Search reindexing are recoverable.

### Negative

- Breaking changes require multiple releases.
- Temporary dual schemas increase complexity and storage.
- CI and deployment orchestration become more demanding.

## Security and privacy impact

- Backfills and migration logs minimize protected content.
- Destructive changes include retention/legal-hold review.
- Restores cannot bypass current permission or deletion state.
- Temporary duplicate columns/tables inherit the original encryption and access controls.

## Failure behavior

- Migration failure prevents the new application version from receiving traffic.
- Partial backfills resume from checkpoints.
- Unsupported destructive rollback is never attempted automatically.
- Emergency restore remains unavailable to normal service code and requires audited operations authorization.

## M2 scope

- Service-local PostgreSQL migration histories.
- Initial schemas and additive M2 changes.
- Migration CI, safe development rollback, compatibility tests, and Search-index versioning foundations.

## Deferred scope

- Production deployment automation.
- Cross-region database restoration.
- Later vector, graph, ClickHouse, and AI-storage migration details.

## Affected services

- All M2 services
- Search Service
- CI and database infrastructure

## Affected documents

- `docs/api/m2/common-contracts.md`
- Every M2 service database specification
- ADR-0002
- ADR-0008
- ADR-0010
- `DATABASE_SCHEMA.md`
- `SERVICE_ARCHITECTURE.md`
- `SYSTEM_ARCHITECTURE.md`
- `API_SPEC.md`
- `MEMORY_ARCHITECTURE.md`
- `PRODUCT_SPEC.md`
- `AI_PIPELINE.md`

## Required follow-up specifications

- Migration tool selection and commands.
- Reversibility classification metadata format.
- Supported previous-version compatibility policy.
- Destructive-change review checklist.
- Backfill checkpoint schema.
- CI test implementation plan.
- Emergency restore runbook.

## Acceptance criteria

- Every migration has one owning service.
- Losslessly reversible changes pass down/reapply tests.
- Destructive down migrations never run automatically in production.
- Breaking changes use expand-and-contract.
- The previous supported application version runs against the expanded schema.
- Backfills are idempotent and resumable.
- Failed deployments have a documented application rollback or forward-compensation path.
- Search mapping changes support validated alias rollback.
- Migration and restore procedures preserve deletion barriers.
