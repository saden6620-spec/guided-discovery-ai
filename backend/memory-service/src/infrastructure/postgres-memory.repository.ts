import { randomUUID } from "node:crypto";

import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

import type { DomainEvent, Inbox, Outbox, OutboxRecord } from "@guided-discovery/events";
import { ConflictException } from "@guided-discovery/errors";
import type { EventId, UtcTimestamp } from "@guided-discovery/shared-types";

import type {
  CreatePersistenceInput,
  DeletePersistenceInput,
  IdempotencyReplay,
  IdempotencyScope,
  MemoryPageResult,
  MemoryRepository,
  MemoryTransaction,
  UpdatePersistenceInput,
} from "../application/ports.js";
import type { MemoryCategory, MemoryLink, MemoryRecord } from "../domain/memory.js";

interface MemoryRow extends QueryResultRow {
  id: string;
  owner_id: string;
  category_id: string;
  category_key: string;
  display_name: string;
  default_sensitivity: MemoryCategory["defaultSensitivity"];
  category_version: number;
  current_version_id: string;
  state: MemoryRecord["state"];
  importance: string;
  sensitivity: MemoryRecord["sensitivity"];
  verification_status: MemoryRecord["verificationStatus"];
  permission_policy_ref: string;
  permission_policy_version: number;
  retention_policy_ref: "U0_ACTIVE";
  user_confirmed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  version: number;
  title_ciphertext: Buffer;
  summary_ciphertext: Buffer;
  purpose_ciphertext: Buffer;
  source_type: MemoryRecord["sourceType"];
  source_ref_ciphertext: Buffer | null;
  originated_at: Date | null;
  confidence: string;
  encryption_state: "ENCRYPTED";
}

const MEMORY_SELECT = `
  SELECT m.id,m.owner_id,m.category_id,c.key AS category_key,c.display_name,c.default_sensitivity,
    c.version AS category_version,m.current_version_id,m.state,m.importance,m.sensitivity,
    m.verification_status,m.permission_policy_ref,m.permission_policy_version,m.retention_policy_ref,
    m.user_confirmed_at,m.created_at,m.updated_at,m.version,v.title_ciphertext,v.summary_ciphertext,
    v.purpose_ciphertext,v.source_type,v.source_ref_ciphertext,v.originated_at,v.confidence,v.encryption_state
  FROM memories m
  JOIN memory_categories c ON c.id=m.category_id AND c.is_active=true
  JOIN memory_versions v ON v.id=m.current_version_id AND v.memory_id=m.id
`;

@Injectable()
export class PostgresMemoryRepository implements MemoryRepository, Outbox, Inbox, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number.parseInt(process.env.DATABASE_POOL_SIZE ?? "10", 10),
    statement_timeout: 2000,
    query_timeout: 2500,
  });

  async transaction<T>(work: (transaction: MemoryTransaction) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
      const result = await work(new PostgresMemoryTransaction(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      if (isPostgresError(error, "40001"))
        throw new ConflictException(
          "CONCURRENT_MODIFICATION",
          "The resource was modified concurrently.",
        );
      if (isPostgresError(error, "23505"))
        throw new ConflictException(
          "RESOURCE_CONFLICT",
          "The requested resource state conflicts with an existing record.",
        );
      throw error;
    } finally {
      client.release();
    }
  }

  async list(input: {
    ownerId: string;
    categoryId?: string;
    limit: number;
    cursor?: { createdAt: Date; id: string };
    order: "asc" | "desc";
  }): Promise<MemoryPageResult> {
    const direction = input.order === "asc" ? "ASC" : "DESC";
    const comparison = input.order === "asc" ? ">" : "<";
    const values: unknown[] = [input.ownerId];
    const predicates = [
      "m.owner_id=$1",
      "m.state='ACTIVE'",
      "m.deleted_at IS NULL",
      "v.encryption_state='ENCRYPTED'",
    ];
    if (input.categoryId !== undefined) {
      values.push(input.categoryId);
      predicates.push(`m.category_id=$${values.length}`);
    }
    if (input.cursor !== undefined) {
      values.push(input.cursor.createdAt, input.cursor.id);
      predicates.push(
        `(m.created_at,m.id) ${comparison} ($${values.length - 1},$${values.length})`,
      );
    }
    values.push(input.limit + 1);
    const result = await this.pool.query<MemoryRow>(
      `${MEMORY_SELECT} WHERE ${predicates.join(" AND ")} ORDER BY m.created_at ${direction},m.id ${direction} LIMIT $${values.length}`,
      values,
    );
    const selected = result.rows.slice(0, input.limit);
    const records = await Promise.all(selected.map((row) => this.hydrate(row, this.pool)));
    const last = selected.at(-1);
    return {
      records,
      hasMore: result.rows.length > input.limit,
      nextCursor:
        last === undefined
          ? null
          : Buffer.from(
              JSON.stringify({ createdAt: last.created_at.toISOString(), id: last.id }),
            ).toString("base64url"),
    };
  }

  async get(id: string, ownerId: string, includeArchived = true): Promise<MemoryRecord | null> {
    const state = includeArchived ? "m.state IN ('ACTIVE','ARCHIVED')" : "m.state='ACTIVE'";
    const result = await this.pool.query<MemoryRow>(
      `${MEMORY_SELECT} WHERE m.id=$1 AND m.owner_id=$2 AND ${state} AND m.deleted_at IS NULL AND v.encryption_state='ENCRYPTED'`,
      [id, ownerId],
    );
    const row = result.rows[0];
    return row === undefined ? null : this.hydrate(row, this.pool);
  }

  async listCategories(): Promise<readonly MemoryCategory[]> {
    const result = await this.pool.query<{
      id: string;
      key: string;
      display_name: string;
      default_sensitivity: MemoryCategory["defaultSensitivity"];
      version: number;
    }>(
      "SELECT id,key,display_name,default_sensitivity,version FROM memory_categories WHERE is_system=true AND is_active=true ORDER BY key",
    );
    return result.rows.map((row) => ({
      id: row.id,
      key: row.key,
      displayName: row.display_name,
      defaultSensitivity: row.default_sensitivity,
      version: row.version,
    }));
  }

  async append(event: DomainEvent): Promise<void> {
    await this.transaction(async (transaction) => transaction.appendEvent(event));
  }

  async pending(limit: number, signal?: AbortSignal): Promise<readonly OutboxRecord[]> {
    if (signal?.aborted === true) throw new Error("OUTBOX_READ_ABORTED");
    const result = await this.pool.query<{
      payload: DomainEvent;
      available_at: Date;
      attempt_count: number;
    }>(
      "SELECT payload,available_at,attempt_count FROM outbox_events WHERE published_at IS NULL AND available_at<=now() ORDER BY available_at,event_id LIMIT $1",
      [Math.max(1, Math.min(limit, 1000))],
    );
    return result.rows.map((row) => ({
      event: row.payload,
      availableAt: row.available_at.toISOString() as UtcTimestamp,
      attemptCount: row.attempt_count,
    }));
  }

  async markPublished(eventId: EventId, publishedAt: UtcTimestamp): Promise<void> {
    await this.pool.query(
      "UPDATE outbox_events SET published_at=$2,last_error_code=NULL WHERE event_id=$1 AND published_at IS NULL",
      [eventId, publishedAt],
    );
  }

  async markFailed(eventId: EventId, errorCode: string): Promise<void> {
    await this.pool.query(
      "UPDATE outbox_events SET attempt_count=attempt_count+1,last_error_code=$2,available_at=now()+LEAST(interval '5 minutes',interval '1 second'*power(2,LEAST(attempt_count,8))) WHERE event_id=$1 AND published_at IS NULL",
      [eventId, errorCode.slice(0, 64)],
    );
  }

  async hasProcessed(consumer: string, eventId: EventId): Promise<boolean> {
    const result = await this.pool.query<{ processed: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM inbox_events WHERE consumer_name=$1 AND event_id=$2 AND processed_at IS NOT NULL) AS processed",
      [consumer, eventId],
    );
    return result.rows[0]?.processed === true;
  }

  async recordProcessed(consumer: string, event: DomainEvent, resultCode: string): Promise<void> {
    await this.pool.query(
      "INSERT INTO inbox_events(consumer_name,event_id,subject_id,subject_version,received_at,processed_at,result_code) VALUES($1,$2,$3,$4,now(),now(),$5) ON CONFLICT(consumer_name,event_id) DO NOTHING",
      [consumer, event.eventId, event.subjectId, event.subjectVersion, resultCode.slice(0, 64)],
    );
  }

  async acknowledgeDeletion(event: DomainEvent): Promise<boolean> {
    const payload = deletionAcknowledgement(event);
    return this.transaction(async (transaction) => {
      const ledger = await transaction.client.query<{ deletion_version: number }>(
        "SELECT deletion_version FROM memory_deletion_ledger WHERE memory_id=$1 FOR UPDATE",
        [payload.memoryId],
      );
      if (ledger.rows[0]?.deletion_version !== payload.deletionVersion) return false;
      const inserted = await transaction.client.query(
        "INSERT INTO inbox_events(consumer_name,event_id,subject_id,subject_version,received_at,processed_at,result_code) VALUES($1,$2,$3,$4,now(),now(),'ACKNOWLEDGED') ON CONFLICT(consumer_name,event_id) DO NOTHING",
        [payload.consumer, event.eventId, payload.memoryId, payload.deletionVersion],
      );
      return inserted.rowCount === 1;
    });
  }

  async purgeDue(requiredConsumers: readonly string[], limit: number): Promise<number> {
    if (requiredConsumers.length === 0) return 0;
    return this.transaction(async (transaction) => {
      const candidates = await transaction.client.query<{
        memory_id: string;
        owner_id: string;
        deletion_version: number;
      }>(
        `SELECT ledger.memory_id,ledger.owner_id,ledger.deletion_version
         FROM memory_deletion_ledger ledger
         WHERE ledger.purge_status='SCHEDULED' AND ledger.purge_after<=now() AND ledger.legal_hold_ref IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM legal_hold_resources resource
             JOIN legal_holds hold ON hold.id=resource.hold_id
             WHERE resource.resource_type='MEMORY' AND resource.resource_id=ledger.memory_id
               AND hold.released_at IS NULL AND (hold.expires_at IS NULL OR hold.expires_at>now())
           )
         ORDER BY ledger.purge_after,ledger.memory_id
         LIMIT $1 FOR UPDATE OF ledger SKIP LOCKED`,
        [Math.max(1, Math.min(limit, 1000))],
      );
      let purged = 0;
      for (const candidate of candidates.rows) {
        const acknowledgements = await transaction.client.query<{ consumer_name: string }>(
          "SELECT DISTINCT consumer_name FROM inbox_events WHERE subject_id=$1 AND subject_version=$2 AND consumer_name=ANY($3::varchar[])",
          [candidate.memory_id, candidate.deletion_version, requiredConsumers],
        );
        if (
          new Set(acknowledgements.rows.map((row) => row.consumer_name)).size !==
          requiredConsumers.length
        )
          continue;
        const purgedAt = new Date();
        await transaction.client.query(
          "DELETE FROM memory_links WHERE source_memory_id=$1 OR target_memory_id=$1",
          [candidate.memory_id],
        );
        await transaction.client.query(
          "DELETE FROM memories WHERE id=$1 AND deleted_at IS NOT NULL",
          [candidate.memory_id],
        );
        await transaction.client.query(
          "UPDATE memory_deletion_ledger SET purge_status='COMPLETE',last_error_code=NULL,updated_at=$2 WHERE memory_id=$1 AND deletion_version=$3",
          [candidate.memory_id, purgedAt, candidate.deletion_version],
        );
        const event = {
          eventId: randomUUID(),
          eventType: "MemoryPurged",
          eventVersion: 1,
          occurredAt: purgedAt.toISOString(),
          producer: "memory-service",
          subjectType: "MEMORY",
          subjectId: candidate.memory_id,
          subjectVersion: candidate.deletion_version,
          ownerId: candidate.owner_id,
          correlationId: randomUUID(),
          deletionVersion: candidate.deletion_version,
          payload: {
            memoryId: candidate.memory_id,
            deletionVersion: candidate.deletion_version,
            purgedAt: purgedAt.toISOString(),
          },
        } as unknown as DomainEvent;
        await transaction.appendEvent(event);
        purged += 1;
      }
      return purged;
    });
  }

  async ping(signal: AbortSignal): Promise<void> {
    if (signal.aborted) throw new Error("HEALTH_CHECK_ABORTED");
    await this.pool.query("SELECT 1");
  }
  async schemaIsCurrent(signal: AbortSignal): Promise<boolean> {
    if (signal.aborted) throw new Error("HEALTH_CHECK_ABORTED");
    const result = await this.pool.query<{ present: boolean }>(
      "SELECT to_regclass('public.memory_deletion_ledger') IS NOT NULL AS present",
    );
    return result.rows[0]?.present === true;
  }
  async close(): Promise<void> {
    await this.pool.end();
  }
  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  private async hydrate(
    row: MemoryRow,
    queryable: Pick<Pool, "query"> | PoolClient,
  ): Promise<MemoryRecord> {
    const linksResult = await queryable.query<{
      id: string;
      source_memory_id: string;
      target_memory_id: string;
      relationship_type: MemoryLink["relationshipType"];
      created_at: Date;
      version: number;
    }>(
      "SELECT id,source_memory_id,target_memory_id,relationship_type,created_at,version FROM memory_links WHERE owner_id=$1 AND deleted_at IS NULL AND (source_memory_id=$2 OR target_memory_id=$2) ORDER BY created_at,id",
      [row.owner_id, row.id],
    );
    return mapMemory(
      row,
      linksResult.rows.map((link) => ({
        id: link.id,
        sourceMemoryId: link.source_memory_id,
        targetMemoryId: link.target_memory_id,
        relationshipType: link.relationship_type,
        createdAt: link.created_at,
        version: link.version,
      })),
    );
  }
}

class PostgresMemoryTransaction implements MemoryTransaction {
  constructor(readonly client: PoolClient) {}

  async getCategory(id: string): Promise<MemoryCategory | null> {
    const result = await this.client.query<{
      id: string;
      key: string;
      display_name: string;
      default_sensitivity: MemoryCategory["defaultSensitivity"];
      version: number;
    }>(
      "SELECT id,key,display_name,default_sensitivity,version FROM memory_categories WHERE id=$1 AND is_system=true AND is_active=true",
      [id],
    );
    const row = result.rows[0];
    return row === undefined
      ? null
      : {
          id: row.id,
          key: row.key,
          displayName: row.display_name,
          defaultSensitivity: row.default_sensitivity,
          version: row.version,
        };
  }

  async get(id: string, ownerId: string, includeArchived = true): Promise<MemoryRecord | null> {
    const state = includeArchived ? "m.state IN ('ACTIVE','ARCHIVED')" : "m.state='ACTIVE'";
    const result = await this.client.query<MemoryRow>(
      `${MEMORY_SELECT} WHERE m.id=$1 AND m.owner_id=$2 AND ${state} AND m.deleted_at IS NULL AND v.encryption_state='ENCRYPTED' FOR UPDATE OF m`,
      [id, ownerId],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    const links = await this.client.query<{
      id: string;
      source_memory_id: string;
      target_memory_id: string;
      relationship_type: MemoryLink["relationshipType"];
      created_at: Date;
      version: number;
    }>(
      "SELECT id,source_memory_id,target_memory_id,relationship_type,created_at,version FROM memory_links WHERE owner_id=$1 AND deleted_at IS NULL AND (source_memory_id=$2 OR target_memory_id=$2) ORDER BY created_at,id",
      [ownerId, id],
    );
    return mapMemory(
      row,
      links.rows.map((link) => ({
        id: link.id,
        sourceMemoryId: link.source_memory_id,
        targetMemoryId: link.target_memory_id,
        relationshipType: link.relationship_type,
        createdAt: link.created_at,
        version: link.version,
      })),
    );
  }

  async getDeletionOwner(id: string): Promise<string | null> {
    const result = await this.client.query<{ owner_id: string }>(
      "SELECT owner_id FROM memory_deletion_ledger WHERE memory_id=$1",
      [id],
    );
    return result.rows[0]?.owner_id ?? null;
  }

  async insertMemory(input: CreatePersistenceInput): Promise<void> {
    await this.client.query(
      "INSERT INTO memories(id,owner_id,category_id,current_version_id,state,importance,sensitivity,verification_status,permission_policy_ref,permission_policy_version,retention_policy_ref,user_confirmed_at,deletion_version,purge_status,created_at,updated_at,version) VALUES($1,$2,$3,NULL,'ACTIVE',$4,$5,$6,$7,$8,'U0_ACTIVE',$9,0,'NOT_SCHEDULED',$10,$10,1)",
      [
        input.id,
        input.ownerId,
        input.categoryId,
        input.importance,
        input.sensitivity,
        input.verificationStatus,
        input.permissionPolicyRef,
        input.permissionPolicyVersion,
        input.userConfirmedAt,
        input.now,
      ],
    );
    await this.client.query(
      "INSERT INTO memory_versions(id,memory_id,version_number,title_ciphertext,summary_ciphertext,purpose_ciphertext,source_type,originated_at,confidence,verification_status,encryption_state,encryption_key_ref,actor_id,created_at) VALUES($1,$2,1,$3,$4,$5,$6,$7,1,$8,'ENCRYPTED',$9,$10,$11)",
      [
        input.versionId,
        input.id,
        input.titleCiphertext,
        input.summaryCiphertext,
        input.purposeCiphertext,
        input.sourceType,
        input.originatedAt,
        input.verificationStatus,
        input.encryptionKeyRef,
        input.actorId,
        input.now,
      ],
    );
    await this.client.query("UPDATE memories SET current_version_id=$2 WHERE id=$1", [
      input.id,
      input.versionId,
    ]);
  }

  async updateMemory(input: UpdatePersistenceInput): Promise<void> {
    const updated = await this.client.query(
      "UPDATE memories SET category_id=$3,importance=$4,sensitivity=$5,state=$6,verification_status=$7,user_confirmed_at=$8,archived_at=CASE WHEN $6::varchar='ARCHIVED' THEN COALESCE(archived_at,$9) ELSE NULL END,current_version_id=$10,updated_at=$9,version=version+1 WHERE id=$1 AND owner_id=$2 AND version=$11 AND deleted_at IS NULL",
      [
        input.id,
        input.ownerId,
        input.categoryId,
        input.importance,
        input.sensitivity,
        input.state,
        input.verificationStatus,
        input.userConfirmedAt,
        input.now,
        input.versionId,
        input.expectedVersion,
      ],
    );
    if (updated.rowCount !== 1)
      throw new ConflictException("VERSION_CONFLICT", "The memory version is stale.");
    await this.client.query(
      "INSERT INTO memory_versions(id,memory_id,version_number,title_ciphertext,summary_ciphertext,purpose_ciphertext,source_type,source_ref_ciphertext,originated_at,confidence,verification_status,correction_reason_ciphertext,encryption_state,encryption_key_ref,actor_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'ENCRYPTED',$13,$14,$15)",
      [
        input.versionId,
        input.id,
        input.versionNumber,
        input.titleCiphertext,
        input.summaryCiphertext,
        input.purposeCiphertext,
        input.sourceType,
        input.sourceRefCiphertext,
        input.originatedAt,
        input.confidence,
        input.verificationStatus,
        input.correctionReasonCiphertext,
        input.encryptionKeyRef,
        input.actorId,
        input.now,
      ],
    );
    for (const operation of input.linkOperations) {
      if (operation.operation === "CREATE")
        await this.client.query(
          "INSERT INTO memory_links(id,owner_id,source_memory_id,target_memory_id,relationship_type,created_at,updated_at,version) VALUES($1,$2,$3,$4,$5,$6,$6,1)",
          [
            operation.id,
            input.ownerId,
            operation.sourceId,
            operation.targetId,
            operation.relationshipType,
            input.now,
          ],
        );
      else {
        const deleted = await this.client.query(
          "UPDATE memory_links SET deleted_at=$4,updated_at=$4,version=version+1 WHERE id=$1 AND owner_id=$2 AND version=$3 AND deleted_at IS NULL",
          [operation.id, input.ownerId, operation.expectedVersion, input.now],
        );
        if (deleted.rowCount !== 1)
          throw new ConflictException("LINK_VERSION_CONFLICT", "The memory link version is stale.");
      }
    }
  }

  async deleteMemory(input: DeletePersistenceInput): Promise<void> {
    await this.client.query(
      "UPDATE memories SET state='DELETED_PENDING_PURGE',deleted_at=$3,purge_after=$4,purge_status='SCHEDULED',deletion_version=$5,current_version_id=NULL,updated_at=$3,version=version+1 WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL",
      [input.id, input.ownerId, input.deletedAt, input.purgeAfter, input.expectedDeletionVersion],
    );
    await this.client.query(
      "UPDATE memory_links SET deleted_at=$2,updated_at=$2,version=version+1 WHERE deleted_at IS NULL AND (source_memory_id=$1 OR target_memory_id=$1)",
      [input.id, input.deletedAt],
    );
    await this.client.query(
      "INSERT INTO memory_deletion_ledger(memory_id,owner_id,deletion_version,deleted_at,purge_after,legal_hold_ref,purge_status,updated_at) VALUES($1,$2,$3,$4,$5,NULL,'SCHEDULED',$4) ON CONFLICT(memory_id) DO UPDATE SET deletion_version=EXCLUDED.deletion_version,deleted_at=EXCLUDED.deleted_at,purge_after=EXCLUDED.purge_after,purge_status='SCHEDULED',updated_at=EXCLUDED.updated_at",
      [input.id, input.ownerId, input.expectedDeletionVersion, input.deletedAt, input.purgeAfter],
    );
  }

  async appendEvent(event: DomainEvent): Promise<void> {
    await this.client.query(
      "INSERT INTO outbox_events(event_id,event_type,event_version,subject_type,subject_id,subject_version,partition_key,payload,occurred_at,available_at,attempt_count,created_at) VALUES($1,$2,$3,$4,$5,$6,$9,$7,$8,$8,0,$8)",
      [
        event.eventId,
        event.eventType,
        event.eventVersion,
        event.subjectType,
        event.subjectId,
        event.subjectVersion,
        JSON.stringify(event),
        event.occurredAt,
        event.subjectId,
      ],
    );
  }

  async findIdempotency(input: IdempotencyScope): Promise<IdempotencyReplay | null> {
    const result = await this.client.query<{
      request_hash: string;
      state: "IN_PROGRESS" | "COMPLETED";
      response_status: number | null;
      response_body: Buffer | null;
    }>(
      "SELECT request_hash,state,response_status,response_body FROM idempotency_records WHERE environment=$1 AND principal_id=$2 AND service='memory-service' AND method=$3 AND route_template=$4 AND key_hash=$5 AND expires_at>now() FOR UPDATE",
      [input.environment, input.principalId, input.method, input.routeTemplate, input.keyHash],
    );
    const row = result.rows[0];
    return row === undefined
      ? null
      : {
          requestHash: row.request_hash,
          state: row.state,
          responseStatus: row.response_status,
          responseBody: row.response_body,
        };
  }
  async beginIdempotency(input: IdempotencyScope & { requestHash: string }): Promise<void> {
    await this.client.query(
      "INSERT INTO idempotency_records(id,environment,principal_id,service,method,route_template,key_hash,request_hash,state,created_at,expires_at) VALUES($1,$2,$3,'memory-service',$4,$5,$6,$7,'IN_PROGRESS',now(),now()+interval '30 days')",
      [
        randomUUID(),
        input.environment,
        input.principalId,
        input.method,
        input.routeTemplate,
        input.keyHash,
        input.requestHash,
      ],
    );
  }
  async completeIdempotency(
    scope: IdempotencyScope,
    encryptedResponse: Buffer,
    status: number,
  ): Promise<void> {
    await this.client.query(
      "UPDATE idempotency_records SET state='COMPLETED',response_status=$6,response_body=$7,completed_at=now() WHERE environment=$1 AND principal_id=$2 AND service='memory-service' AND method=$3 AND route_template=$4 AND key_hash=$5",
      [
        scope.environment,
        scope.principalId,
        scope.method,
        scope.routeTemplate,
        scope.keyHash,
        status,
        encryptedResponse,
      ],
    );
  }
}

function mapMemory(row: MemoryRow, links: readonly MemoryLink[]): MemoryRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    category: {
      id: row.category_id,
      key: row.category_key,
      displayName: row.display_name,
      defaultSensitivity: row.default_sensitivity,
      version: row.category_version,
    },
    currentVersionId: row.current_version_id,
    state: row.state,
    importance: Number(row.importance),
    sensitivity: row.sensitivity,
    verificationStatus: row.verification_status,
    permissionPolicyRef: row.permission_policy_ref,
    permissionPolicyVersion: row.permission_policy_version,
    retentionPolicyRef: row.retention_policy_ref,
    userConfirmedAt: row.user_confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    titleCiphertext: row.title_ciphertext,
    summaryCiphertext: row.summary_ciphertext,
    purposeCiphertext: row.purpose_ciphertext,
    sourceType: row.source_type,
    sourceRefCiphertext: row.source_ref_ciphertext,
    originatedAt: row.originated_at,
    confidence: Number(row.confidence),
    encryptionState: row.encryption_state,
    links,
  };
}

function isPostgresError(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function deletionAcknowledgement(event: DomainEvent): {
  memoryId: string;
  deletionVersion: number;
  consumer: string;
} {
  const payload = event.payload as Partial<{
    memoryId: string;
    deletionVersion: number;
    consumer: string;
    acknowledgedAt: string;
  }>;
  if (
    event.eventType !== "MemoryDeletionAcknowledged" ||
    event.eventVersion !== 1 ||
    typeof payload.memoryId !== "string" ||
    !Number.isInteger(payload.deletionVersion) ||
    typeof payload.consumer !== "string" ||
    !/^[a-z][a-z0-9-]{2,63}$/u.test(payload.consumer) ||
    typeof payload.acknowledgedAt !== "string"
  )
    throw new Error("MEMORY_DELETION_ACKNOWLEDGEMENT_INVALID");
  return {
    memoryId: payload.memoryId,
    deletionVersion: payload.deletionVersion as number,
    consumer: payload.consumer,
  };
}
