-- CreateTable
CREATE TABLE "memory_categories" (
    "id" UUID NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "default_sensitivity" VARCHAR(32) NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "memory_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memories" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "current_version_id" UUID,
    "state" VARCHAR(32) NOT NULL,
    "importance" DECIMAL(4,3) NOT NULL,
    "sensitivity" VARCHAR(32) NOT NULL,
    "verification_status" VARCHAR(32) NOT NULL,
    "permission_policy_ref" VARCHAR(128) NOT NULL,
    "permission_policy_version" INTEGER NOT NULL,
    "retention_policy_ref" VARCHAR(64) NOT NULL,
    "user_confirmed_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "deletion_version" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMPTZ(3),
    "purge_after" TIMESTAMPTZ(3),
    "purge_status" VARCHAR(32) NOT NULL,
    "legal_hold_ref" VARCHAR(128),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_versions" (
    "id" UUID NOT NULL,
    "memory_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "title_ciphertext" BYTEA NOT NULL,
    "summary_ciphertext" BYTEA NOT NULL,
    "purpose_ciphertext" BYTEA NOT NULL,
    "source_type" VARCHAR(32) NOT NULL,
    "source_ref_ciphertext" BYTEA,
    "originated_at" TIMESTAMPTZ(3),
    "confidence" DECIMAL(4,3) NOT NULL,
    "verification_status" VARCHAR(32) NOT NULL,
    "correction_reason_ciphertext" BYTEA,
    "encryption_state" VARCHAR(32) NOT NULL,
    "encryption_key_ref" VARCHAR(256) NOT NULL,
    "actor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "memory_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_links" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "source_memory_id" UUID NOT NULL,
    "target_memory_id" UUID NOT NULL,
    "relationship_type" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL,

    CONSTRAINT "memory_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_deletion_ledger" (
    "memory_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "deletion_version" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(3) NOT NULL,
    "purge_after" TIMESTAMPTZ(3) NOT NULL,
    "legal_hold_ref" VARCHAR(128),
    "purge_status" VARCHAR(32) NOT NULL,
    "last_error_code" VARCHAR(64),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "memory_deletion_ledger_pkey" PRIMARY KEY ("memory_id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "event_id" UUID NOT NULL,
    "event_type" VARCHAR(128) NOT NULL,
    "event_version" INTEGER NOT NULL,
    "subject_type" VARCHAR(64) NOT NULL,
    "subject_id" UUID NOT NULL,
    "subject_version" INTEGER NOT NULL,
    "partition_key" VARCHAR(128) NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "available_at" TIMESTAMPTZ(3) NOT NULL,
    "published_at" TIMESTAMPTZ(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error_code" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "inbox_events" (
    "consumer_name" VARCHAR(64) NOT NULL,
    "event_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "subject_version" INTEGER NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL,
    "processed_at" TIMESTAMPTZ(3),
    "result_code" VARCHAR(64) NOT NULL,

    CONSTRAINT "inbox_events_pkey" PRIMARY KEY ("consumer_name","event_id")
);

-- CreateTable
CREATE TABLE "dead_letter_events" (
    "id" UUID NOT NULL,
    "original_event_id" UUID NOT NULL,
    "consumer_name" VARCHAR(64) NOT NULL,
    "event_type" VARCHAR(128) NOT NULL,
    "event_version" INTEGER NOT NULL,
    "payload" BYTEA NOT NULL,
    "failure_code" VARCHAR(64) NOT NULL,
    "attempt_count" INTEGER NOT NULL,
    "first_failed_at" TIMESTAMPTZ(3) NOT NULL,
    "last_failed_at" TIMESTAMPTZ(3) NOT NULL,
    "resolved_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dead_letter_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_holds" (
    "id" UUID NOT NULL,
    "authority_ref" VARCHAR(128) NOT NULL,
    "reason_category" VARCHAR(64) NOT NULL,
    "actor_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "released_at" TIMESTAMPTZ(3),
    "released_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL,

    CONSTRAINT "legal_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_hold_resources" (
    "hold_id" UUID NOT NULL,
    "resource_type" VARCHAR(64) NOT NULL,
    "resource_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "legal_hold_resources_pkey" PRIMARY KEY ("hold_id","resource_type","resource_id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "environment" VARCHAR(32) NOT NULL,
    "principal_id" UUID NOT NULL,
    "service" VARCHAR(64) NOT NULL,
    "method" VARCHAR(16) NOT NULL,
    "route_template" VARCHAR(256) NOT NULL,
    "key_hash" VARCHAR(64) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "state" VARCHAR(16) NOT NULL,
    "response_status" INTEGER,
    "response_body" BYTEA,
    "response_headers" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "memory_categories_key_key" ON "memory_categories"("key");

-- CreateIndex
CREATE INDEX "memories_owner_id_state_created_at_id_idx" ON "memories"("owner_id", "state", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "memories_owner_id_category_id_state_created_at_idx" ON "memories"("owner_id", "category_id", "state", "created_at" DESC);

-- CreateIndex
CREATE INDEX "memories_purge_status_purge_after_idx" ON "memories"("purge_status", "purge_after");

-- CreateIndex
CREATE INDEX "memories_owner_id_deletion_version_idx" ON "memories"("owner_id", "deletion_version");

-- CreateIndex
CREATE UNIQUE INDEX "memory_versions_memory_id_version_number_key" ON "memory_versions"("memory_id", "version_number");

-- CreateIndex
CREATE INDEX "memory_links_source_memory_id_deleted_at_idx" ON "memory_links"("source_memory_id", "deleted_at");

-- CreateIndex
CREATE INDEX "memory_links_target_memory_id_deleted_at_idx" ON "memory_links"("target_memory_id", "deleted_at");

-- CreateIndex
CREATE INDEX "memory_deletion_ledger_purge_status_purge_after_idx" ON "memory_deletion_ledger"("purge_status", "purge_after");

-- CreateIndex
CREATE INDEX "outbox_events_available_at_event_id_idx" ON "outbox_events"("available_at", "event_id");

-- CreateIndex
CREATE INDEX "inbox_events_received_at_idx" ON "inbox_events"("received_at");

-- CreateIndex
CREATE INDEX "dead_letter_events_expires_at_idx" ON "dead_letter_events"("expires_at");

-- CreateIndex
CREATE INDEX "legal_holds_expires_at_released_at_idx" ON "legal_holds"("expires_at", "released_at");

-- CreateIndex
CREATE INDEX "legal_hold_resources_resource_type_resource_id_idx" ON "legal_hold_resources"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_environment_principal_id_service_method_key" ON "idempotency_records"("environment", "principal_id", "service", "method", "route_template", "key_hash");

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "memory_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_versions" ADD CONSTRAINT "memory_versions_memory_id_fkey" FOREIGN KEY ("memory_id") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_hold_resources" ADD CONSTRAINT "legal_hold_resources_hold_id_fkey" FOREIGN KEY ("hold_id") REFERENCES "legal_holds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-audited domain constraints required by ADR-0011.
ALTER TABLE "memories" ADD CONSTRAINT "memories_version_positive" CHECK ("version" > 0);
ALTER TABLE "memories" ADD CONSTRAINT "memories_importance_range" CHECK ("importance" >= 0 AND "importance" <= 1);
ALTER TABLE "memories" ADD CONSTRAINT "memories_policy_version_positive" CHECK ("permission_policy_version" > 0);
ALTER TABLE "memories" ADD CONSTRAINT "memories_deletion_version_nonnegative" CHECK ("deletion_version" >= 0);
ALTER TABLE "memories" ADD CONSTRAINT "memories_state_allowed" CHECK ("state" IN ('ACTIVE','ARCHIVED','DELETED_PENDING_PURGE'));
ALTER TABLE "memories" ADD CONSTRAINT "memories_sensitivity_allowed" CHECK ("sensitivity" IN ('STANDARD','SENSITIVE','HIGHLY_SENSITIVE'));
ALTER TABLE "memories" ADD CONSTRAINT "memories_verification_allowed" CHECK ("verification_status" IN ('UNVERIFIED','USER_CONFIRMED','SOURCE_VERIFIED','CORRECTED'));
ALTER TABLE "memories" ADD CONSTRAINT "memories_purge_status_allowed" CHECK ("purge_status" IN ('NOT_SCHEDULED','SCHEDULED','IN_PROGRESS','COMPLETE','FAILED'));
ALTER TABLE "memories" ADD CONSTRAINT "memories_lifecycle_consistent" CHECK (
  ("state" = 'ACTIVE' AND "archived_at" IS NULL AND "deleted_at" IS NULL AND "purge_after" IS NULL AND "purge_status" = 'NOT_SCHEDULED') OR
  ("state" = 'ARCHIVED' AND "archived_at" IS NOT NULL AND "deleted_at" IS NULL AND "purge_after" IS NULL AND "purge_status" = 'NOT_SCHEDULED') OR
  ("state" = 'DELETED_PENDING_PURGE' AND "deleted_at" IS NOT NULL AND "purge_after" IS NOT NULL AND "deletion_version" > 0 AND "purge_status" <> 'NOT_SCHEDULED')
);
ALTER TABLE "memories" ADD CONSTRAINT "memories_confirmation_consistent" CHECK (
  ("verification_status" = 'USER_CONFIRMED' AND "user_confirmed_at" IS NOT NULL) OR
  ("verification_status" <> 'USER_CONFIRMED' AND "user_confirmed_at" IS NULL)
);
ALTER TABLE "memory_versions" ADD CONSTRAINT "memory_versions_number_positive" CHECK ("version_number" > 0);
ALTER TABLE "memory_versions" ADD CONSTRAINT "memory_versions_confidence_range" CHECK ("confidence" >= 0 AND "confidence" <= 1);
ALTER TABLE "memory_versions" ADD CONSTRAINT "memory_versions_source_allowed" CHECK ("source_type" IN ('USER_EXPLICIT','USER_CONFIRMED','IMPORT','SERVICE_EVENT'));
ALTER TABLE "memory_versions" ADD CONSTRAINT "memory_versions_encryption_allowed" CHECK ("encryption_state" IN ('PENDING','ENCRYPTED','ROTATION_REQUIRED','FAILED'));
ALTER TABLE "memory_links" ADD CONSTRAINT "memory_links_version_positive" CHECK ("version" > 0);
ALTER TABLE "memory_links" ADD CONSTRAINT "memory_links_not_self" CHECK ("source_memory_id" <> "target_memory_id");
ALTER TABLE "memory_links" ADD CONSTRAINT "memory_links_relationship_allowed" CHECK ("relationship_type" IN ('RELATED_TO','SUPERSEDES','SUPPORTS','CONTRADICTS','PART_OF'));
ALTER TABLE "memory_links" ADD CONSTRAINT "memory_links_source_fkey" FOREIGN KEY ("source_memory_id") REFERENCES "memories"("id") ON DELETE CASCADE;
ALTER TABLE "memory_links" ADD CONSTRAINT "memory_links_target_fkey" FOREIGN KEY ("target_memory_id") REFERENCES "memories"("id") ON DELETE CASCADE;
ALTER TABLE "memories" ADD CONSTRAINT "memories_current_version_fkey" FOREIGN KEY ("current_version_id") REFERENCES "memory_versions"("id") DEFERRABLE INITIALLY DEFERRED;
CREATE UNIQUE INDEX "memory_links_active_unique" ON "memory_links"("source_memory_id","target_memory_id","relationship_type") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "memory_categories_lower_key_unique" ON "memory_categories"(lower("key"));

ALTER TABLE "memory_deletion_ledger" ADD CONSTRAINT "memory_deletion_ledger_version_positive" CHECK ("deletion_version" > 0);
ALTER TABLE "memory_deletion_ledger" ADD CONSTRAINT "memory_deletion_ledger_purge_status_allowed" CHECK ("purge_status" IN ('SCHEDULED','IN_PROGRESS','COMPLETE','FAILED'));

-- Immutable, stable system-category catalog from the approved internal contract.
INSERT INTO "memory_categories" ("id","key","display_name","default_sensitivity","is_system","is_active","version","created_at","updated_at") VALUES
('cdbcc674-50be-5a1e-b0cc-aa75d3f42fd4','PROFILE','Profile','SENSITIVE',true,true,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('98c7bc59-e1d0-5fef-a7b0-8928588f8ddf','GOAL','Goal','STANDARD',true,true,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('449e6134-07e0-5bde-a58b-13b7060715d2','LEARNING_PROGRESS','Learning progress','STANDARD',true,true,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('b114b5b1-77a5-5202-a2ef-da57edb5af5a','SKILL','Skill','STANDARD',true,true,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('c753a23d-78e3-5f91-b9f8-e6de97c0128f','PREFERENCE','Preference','STANDARD',true,true,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('59360882-2cb3-5604-832b-3d53b67e74ce','TRAVEL_HISTORY','Travel history','SENSITIVE',true,true,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('d1b12e5c-6798-528a-94a2-00df444a6d0a','INTEREST','Interest','STANDARD',true,true,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('077d9dcd-1614-58a6-806b-62049cf760a0','JOURNAL','Journal','SENSITIVE',true,true,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('e60754fd-eba3-5eae-90cb-0a38e4abf899','EXPERIENCE','Experience','STANDARD',true,true,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('00708797-403a-5bc2-bb85-fe8378c50eb9','HEALTH','Health','HIGHLY_SENSITIVE',true,true,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('6cd8f1aa-e208-5d37-bfec-0927e6c48de4','SAFETY_PREFERENCE','Safety preference','HIGHLY_SENSITIVE',true,true,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
