import { Injectable } from "@nestjs/common";
import { ConflictException } from "@guided-discovery/errors";
import type { DomainEvent } from "@guided-discovery/events";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import type { IdempotencyInput, JournalRepository } from "../application/ports.js";
import type { JournalRecord } from "../domain/journal.js";
import { AesGcmEncryptionAdapter } from "./encryption.js";
@Injectable()
export class PostgresJournalRepository implements JournalRepository {
  private readonly pool = new Pool({
    connectionString: process.env.DOCUMENTATION_DATABASE_URL ?? process.env.DATABASE_URL,
  });
  private readonly encryption = new AesGcmEncryptionAdapter();
  async ping() {
    await this.pool.query("SELECT 1");
  }
  async schemaIsCurrent() {
    const r = await this.pool.query("SELECT to_regclass('public.journals') IS NOT NULL ok");
    return r.rows[0]?.ok === true;
  }
  async onModuleDestroy() {
    await this.pool.end();
  }
  async list(input: Parameters<JournalRepository["list"]>[0]) {
    const values: unknown[] = [input.ownerId, input.limit + 1];
    let where = "owner_id=$1 AND deleted_at IS NULL";
    if (input.tripId) {
      values.push(input.tripId);
      where += ` AND trip_id=$${values.length}`;
    }
    if (input.startedFrom) {
      values.push(input.startedFrom);
      where += ` AND started_at >= $${values.length}`;
    }
    if (input.startedTo) {
      values.push(input.startedTo);
      where += ` AND started_at <= $${values.length}`;
    }
    if (input.cursor) {
      values.push(input.cursor.createdAt, input.cursor.id);
      where += ` AND (created_at,id) < ($${values.length - 1},$${values.length})`;
    }
    const rows = await this.pool.query(
      `SELECT * FROM journals WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT $2`,
      values,
    );
    const selected = rows.rows.slice(0, input.limit),
      records = await Promise.all(selected.map((v) => this.hydrate(this.pool, v)));
    const last = selected.at(-1);
    return {
      records,
      hasMore: rows.rows.length > input.limit,
      nextCursor:
        last && rows.rows.length > input.limit
          ? Buffer.from(JSON.stringify({ createdAt: last.created_at, id: last.id })).toString(
              "base64url",
            )
          : null,
    };
  }
  async get(id: string, ownerId: string) {
    const r = await this.pool.query(
      "SELECT * FROM journals WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL",
      [id, ownerId],
    );
    return r.rows[0] ? this.hydrate(this.pool, r.rows[0]) : null;
  }
  async create(
    record: JournalRecord,
    event: DomainEvent,
    idem: IdempotencyInput,
    response: Buffer,
  ) {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const prior = await c.query(
        "SELECT state,request_hash,response_body_ciphertext FROM idempotency_records WHERE environment=$1 AND principal_id=$2 AND service='documentation-service' AND method='POST' AND route_template='/api/v1/journals' AND key_hash=$3",
        [idem.environment, idem.principalId, idem.keyHash],
      );
      if (prior.rows[0]) {
        await c.query("ROLLBACK");
        return {
          state: prior.rows[0].state,
          requestHash: prior.rows[0].request_hash,
          responseBody: prior.rows[0].response_body_ciphertext,
        };
      }
      await c.query(
        "INSERT INTO idempotency_records VALUES($1,$2,'documentation-service','POST','/api/v1/journals',$3,$4,'IN_PROGRESS',NULL,NULL,now(),now()+interval '30 days')",
        [idem.environment, idem.principalId, idem.keyHash, idem.requestHash],
      );
      await this.writeJournal(c, record);
      await this.replaceChildren(c, record);
      await this.outbox(c, event);
      await c.query(
        "UPDATE idempotency_records SET state='COMPLETED',response_status=201,response_body_ciphertext=$1 WHERE environment=$2 AND principal_id=$3 AND service='documentation-service' AND method='POST' AND route_template='/api/v1/journals' AND key_hash=$4",
        [response, idem.environment, idem.principalId, idem.keyHash],
      );
      await c.query("COMMIT");
      return record;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  async update(record: JournalRecord, expectedVersion: number, event: DomainEvent) {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const r = await c.query(
        "UPDATE journals SET title_ciphertext=$1,description_ciphertext=$2,trip_id=$3,started_at=$4,ended_at=$5,updated_at=$6,version=$7 WHERE id=$8 AND owner_id=$9 AND version=$10 AND deleted_at IS NULL",
        [
          this.enc(record.title),
          this.encNull(record.description),
          record.tripId,
          record.startedAt,
          record.endedAt,
          record.updatedAt,
          record.version,
          record.id,
          record.ownerId,
          expectedVersion,
        ],
      );
      if (r.rowCount !== 1)
        throw new ConflictException("VERSION_CONFLICT", "The journal version has changed.");
      await this.syncChildren(c, record);
      await this.outbox(c, event);
      await c.query("COMMIT");
      return record;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  async delete(id: string, ownerId: string, event: DomainEvent, deletedAt: Date, purgeAfter: Date) {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const held = await c.query(
        "SELECT 1 FROM legal_hold_resources r JOIN legal_holds h ON h.id=r.hold_id WHERE r.resource_type='JOURNAL' AND r.resource_id=$1 AND h.released_at IS NULL AND (h.expires_at IS NULL OR h.expires_at>now())",
        [id],
      );
      const r = await c.query(
        "UPDATE journals SET deleted_at=$1,purge_after=$2,updated_at=$1,version=version+1 WHERE id=$3 AND owner_id=$4 AND deleted_at IS NULL",
        [deletedAt, held.rowCount ? null : purgeAfter, id, ownerId],
      );
      if (r.rowCount !== 1) {
        await c.query("ROLLBACK");
        return "NOT_FOUND";
      }
      await this.outbox(c, event);
      await c.query("COMMIT");
      return "DELETED";
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  private async writeJournal(c: PoolClient, j: JournalRecord) {
    await c.query(
      "INSERT INTO journals(id,owner_id,title_ciphertext,description_ciphertext,trip_id,permission_policy_ref,permission_policy_version,started_at,ended_at,created_at,updated_at,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
      [
        j.id,
        j.ownerId,
        this.enc(j.title),
        this.encNull(j.description),
        j.tripId,
        j.permissionPolicyRef,
        j.permissionPolicyVersion,
        j.startedAt,
        j.endedAt,
        j.createdAt,
        j.updatedAt,
        j.version,
      ],
    );
  }
  private async replaceChildren(c: PoolClient, j: JournalRecord) {
    for (const m of j.media)
      await c.query(
        "INSERT INTO journal_media_references(id,journal_id,media_id,media_kind,caption_ciphertext,position,created_at,updated_at,version) VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8)",
        [
          m.id,
          j.id,
          m.mediaId,
          m.mediaKind,
          this.encNull(m.caption),
          m.position,
          j.updatedAt,
          m.version,
        ],
      );
    for (const e of j.entries)
      await c.query(
        "INSERT INTO journal_entries(id,journal_id,position,type,content_ciphertext,media_reference_id,occurred_at,location_reference_ciphertext,created_at,updated_at,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10)",
        [
          e.id,
          j.id,
          e.position,
          e.type,
          this.encNull(e.content),
          e.mediaReferenceId,
          e.occurredAt,
          this.encNull(e.locationReference),
          j.updatedAt,
          e.version,
        ],
      );
    for (const r of j.reflections)
      await c.query(
        "INSERT INTO reflections(id,journal_id,entry_id,text_ciphertext,occurred_at,position,created_at,updated_at,version) VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8)",
        [r.id, j.id, r.entryId, this.enc(r.text), r.occurredAt, r.position, j.updatedAt, r.version],
      );
  }
  private async syncChildren(c: PoolClient, j: JournalRecord) {
    const ids = (v: readonly { id: string }[]) => v.map((x) => x.id);
    await c.query(
      "UPDATE reflections SET deleted_at=$2,updated_at=$2 WHERE journal_id=$1 AND deleted_at IS NULL AND NOT(id=ANY($3::uuid[]))",
      [j.id, j.updatedAt, ids(j.reflections)],
    );
    await c.query(
      "UPDATE journal_entries SET deleted_at=$2,updated_at=$2 WHERE journal_id=$1 AND deleted_at IS NULL AND NOT(id=ANY($3::uuid[]))",
      [j.id, j.updatedAt, ids(j.entries)],
    );
    await c.query(
      "UPDATE journal_media_references SET deleted_at=$2,updated_at=$2 WHERE journal_id=$1 AND deleted_at IS NULL AND NOT(id=ANY($3::uuid[]))",
      [j.id, j.updatedAt, ids(j.media)],
    );
    await c.query(
      "UPDATE journal_media_references SET position=position+1000000 WHERE journal_id=$1 AND deleted_at IS NULL",
      [j.id],
    );
    await c.query(
      "UPDATE journal_entries SET position=position+1000000 WHERE journal_id=$1 AND deleted_at IS NULL",
      [j.id],
    );
    await c.query(
      "UPDATE reflections SET position=position+1000000 WHERE journal_id=$1 AND deleted_at IS NULL",
      [j.id],
    );
    for (const m of j.media)
      await c.query(
        "INSERT INTO journal_media_references(id,journal_id,media_id,media_kind,caption_ciphertext,position,created_at,updated_at,version) VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8) ON CONFLICT(id) DO UPDATE SET media_id=excluded.media_id,media_kind=excluded.media_kind,caption_ciphertext=excluded.caption_ciphertext,position=excluded.position,updated_at=excluded.updated_at,version=excluded.version,deleted_at=NULL",
        [
          m.id,
          j.id,
          m.mediaId,
          m.mediaKind,
          this.encNull(m.caption),
          m.position,
          j.updatedAt,
          m.version,
        ],
      );
    for (const e of j.entries)
      await c.query(
        "INSERT INTO journal_entries(id,journal_id,position,type,content_ciphertext,media_reference_id,occurred_at,location_reference_ciphertext,created_at,updated_at,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10) ON CONFLICT(id) DO UPDATE SET position=excluded.position,type=excluded.type,content_ciphertext=excluded.content_ciphertext,media_reference_id=excluded.media_reference_id,occurred_at=excluded.occurred_at,location_reference_ciphertext=excluded.location_reference_ciphertext,updated_at=excluded.updated_at,version=excluded.version,deleted_at=NULL",
        [
          e.id,
          j.id,
          e.position,
          e.type,
          this.encNull(e.content),
          e.mediaReferenceId,
          e.occurredAt,
          this.encNull(e.locationReference),
          j.updatedAt,
          e.version,
        ],
      );
    for (const r of j.reflections)
      await c.query(
        "INSERT INTO reflections(id,journal_id,entry_id,text_ciphertext,occurred_at,position,created_at,updated_at,version) VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8) ON CONFLICT(id) DO UPDATE SET entry_id=excluded.entry_id,text_ciphertext=excluded.text_ciphertext,occurred_at=excluded.occurred_at,position=excluded.position,updated_at=excluded.updated_at,version=excluded.version,deleted_at=NULL",
        [r.id, j.id, r.entryId, this.enc(r.text), r.occurredAt, r.position, j.updatedAt, r.version],
      );
  }
  private async hydrate(
    q: { query: (sql: string, values?: unknown[]) => Promise<{ rows: QueryResultRow[] }> },
    row: QueryResultRow,
  ): Promise<JournalRecord> {
    const [entries, refs, reflections] = await Promise.all([
      q.query(
        "SELECT * FROM journal_entries WHERE journal_id=$1 AND deleted_at IS NULL ORDER BY position,id",
        [row.id],
      ),
      q.query(
        "SELECT * FROM journal_media_references WHERE journal_id=$1 AND deleted_at IS NULL ORDER BY position,id",
        [row.id],
      ),
      q.query(
        "SELECT * FROM reflections WHERE journal_id=$1 AND deleted_at IS NULL ORDER BY position,id",
        [row.id],
      ),
    ]);
    return {
      id: row.id,
      ownerId: row.owner_id,
      title: this.dec(row.title_ciphertext),
      description: this.decNull(row.description_ciphertext),
      tripId: row.trip_id,
      permissionPolicyRef: row.permission_policy_ref,
      permissionPolicyVersion: row.permission_policy_version,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      entries: entries.rows.map((v) => ({
        id: v.id,
        type: v.type,
        content: this.decNull(v.content_ciphertext),
        mediaReferenceId: v.media_reference_id,
        occurredAt: v.occurred_at,
        locationReference: this.decNull(v.location_reference_ciphertext),
        position: v.position,
        version: v.version,
      })),
      media: refs.rows.map((v) => ({
        id: v.id,
        mediaId: v.media_id,
        mediaKind: v.media_kind,
        caption: this.decNull(v.caption_ciphertext),
        position: v.position,
        version: v.version,
      })),
      reflections: reflections.rows.map((v) => ({
        id: v.id,
        entryId: v.entry_id,
        text: this.dec(v.text_ciphertext),
        occurredAt: v.occurred_at,
        position: v.position,
        version: v.version,
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
    };
  }
  private async outbox(c: PoolClient, e: DomainEvent) {
    await c.query(
      "INSERT INTO outbox_events(event_id,event_type,event_version,subject_type,subject_id,subject_version,partition_key,payload,occurred_at,available_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)",
      [
        e.eventId,
        e.eventType,
        e.eventVersion,
        e.subjectType,
        e.subjectId,
        e.subjectVersion,
        e.subjectId,
        JSON.stringify(e),
        e.occurredAt,
      ],
    );
  }
  private enc(v: string) {
    return this.encryption.encrypt(v);
  }
  private encNull(v: string | null) {
    return v === null ? null : this.enc(v);
  }
  private dec(v: Buffer) {
    return this.encryption.decrypt(v);
  }
  private decNull(v: Buffer | null) {
    return v === null ? null : this.dec(v);
  }
}
