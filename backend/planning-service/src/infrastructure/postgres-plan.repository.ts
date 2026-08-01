import { Inject, Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { ConflictException, InfrastructureException } from "@guided-discovery/errors";
import type { DomainEvent } from "@guided-discovery/events";
import type { PlanRecord } from "../domain/plan.js";
import {
  ENCRYPTION_ADAPTER,
  type EncryptionAdapter,
  type IdempotencyReplay,
  type IdempotencyScope,
  type PlanPageResult,
  type PlanRepository,
} from "../application/ports.js";

@Injectable()
export class PostgresPlanRepository implements PlanRepository, OnApplicationShutdown {
  private readonly pool = new Pool({
    connectionString: process.env.PLANNING_DATABASE_URL ?? process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  });
  constructor(@Inject(ENCRYPTION_ADAPTER) private readonly encryption: EncryptionAdapter) {}
  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }
  async close(): Promise<void> {
    await this.pool.end();
  }
  async ping(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    await this.pool.query("SELECT 1");
  }
  async schemaIsCurrent(signal: AbortSignal): Promise<boolean> {
    signal.throwIfAborted();
    const result = await this.pool.query(
      "SELECT to_regclass('public.itineraries') IS NOT NULL AS current",
    );
    return result.rows[0]?.current === true;
  }

  async list(input: {
    ownerId: string;
    limit: number;
    status?: string;
    startDateFrom?: string;
    startDateTo?: string;
    cursor?: { createdAt: Date; id: string };
  }): Promise<PlanPageResult> {
    const values: unknown[] = [input.ownerId];
    const conditions = ["owner_id=$1", "deleted_at IS NULL"];
    if (input.status !== undefined) {
      values.push(input.status);
      conditions.push(`status=$${values.length}`);
    }
    if (input.startDateFrom !== undefined) {
      values.push(input.startDateFrom);
      conditions.push(`start_date >= $${values.length}`);
    }
    if (input.startDateTo !== undefined) {
      values.push(input.startDateTo);
      conditions.push(`start_date <= $${values.length}`);
    }
    if (input.cursor !== undefined) {
      values.push(input.cursor.createdAt, input.cursor.id);
      conditions.push(`(created_at,id) < ($${values.length - 1},$${values.length})`);
    }
    values.push(input.limit + 1);
    const result = await this.pool.query(
      `SELECT id FROM itineraries WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC,id DESC LIMIT $${values.length}`,
      values,
    );
    const ids = result.rows.map((row: QueryResultRow) => String(row.id));
    const hasMore = ids.length > input.limit;
    const selected = ids.slice(0, input.limit);
    const records = await Promise.all(
      selected.map(async (id) => this.getRequired(id, input.ownerId)),
    );
    const last = records.at(-1);
    return {
      records,
      hasMore,
      nextCursor:
        hasMore && last !== undefined
          ? Buffer.from(
              JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id }),
            ).toString("base64url")
          : null,
    };
  }
  async get(id: string, ownerId: string): Promise<PlanRecord | null> {
    const result = await this.pool.query(
      "SELECT * FROM itineraries WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL",
      [id, ownerId],
    );
    return result.rowCount === 0 ? null : this.hydrate(result.rows[0] as QueryResultRow);
  }
  private async getRequired(id: string, ownerId: string): Promise<PlanRecord> {
    const value = await this.get(id, ownerId);
    if (value === null) throw new Error("plan_disappeared");
    return value;
  }

  async create(
    plan: PlanRecord,
    event: DomainEvent,
    scope: IdempotencyScope,
    encryptedResponse: Buffer,
  ): Promise<PlanRecord | IdempotencyReplay> {
    return this.transaction(async (client) => {
      const existing = await client.query(
        "SELECT request_hash,state,response_status,response_body FROM idempotency_records WHERE environment=$1 AND principal_id=$2 AND service='planning-service' AND method='POST' AND route_template='/api/v1/plans' AND key_hash=$3 FOR UPDATE",
        [scope.environment, scope.principalId, scope.keyHash],
      );
      if ((existing.rowCount ?? 0) > 0) {
        const row = existing.rows[0] as QueryResultRow;
        return {
          requestHash: String(row.request_hash),
          state: String(row.state) as "IN_PROGRESS" | "COMPLETED",
          responseStatus: row.response_status === null ? null : Number(row.response_status),
          responseBody: row.response_body as Buffer | null,
        };
      }
      await client.query(
        "INSERT INTO idempotency_records(id,environment,principal_id,service,method,route_template,key_hash,request_hash,state,created_at,expires_at) VALUES($1,$2,$3,'planning-service','POST','/api/v1/plans',$4,$5,'IN_PROGRESS',$6,$7)",
        [
          crypto.randomUUID(),
          scope.environment,
          scope.principalId,
          scope.keyHash,
          scope.requestHash,
          plan.createdAt,
          new Date(plan.createdAt.getTime() + 30 * 86_400_000),
        ],
      );
      await this.insertAggregate(client, plan);
      await this.appendEvent(client, event);
      await client.query(
        "UPDATE idempotency_records SET state='COMPLETED',response_status=201,response_body=$1,completed_at=$2 WHERE environment=$3 AND principal_id=$4 AND service='planning-service' AND method='POST' AND route_template='/api/v1/plans' AND key_hash=$5",
        [encryptedResponse, plan.createdAt, scope.environment, scope.principalId, scope.keyHash],
      );
      return plan;
    });
  }

  async update(plan: PlanRecord, expectedVersion: number, event: DomainEvent): Promise<PlanRecord> {
    return this.transaction(async (client) => {
      const changed = await client.query(
        "UPDATE itineraries SET title=$1,status=$2,start_date=$3,end_date=$4,budget_amount=$5,budget_currency=$6,notes_ciphertext=$7,updated_at=$8,version=$9 WHERE id=$10 AND owner_id=$11 AND deleted_at IS NULL AND version=$12",
        [
          plan.title,
          plan.status,
          plan.startDate,
          plan.endDate,
          plan.budgetAmount,
          plan.budgetCurrency,
          this.encrypt(plan.notes),
          plan.updatedAt,
          plan.version,
          plan.id,
          plan.ownerId,
          expectedVersion,
        ],
      );
      if (changed.rowCount !== 1)
        throw new ConflictException("VERSION_CONFLICT", "The plan version has changed.");
      await this.syncChildren(client, plan);
      await this.appendEvent(client, event);
      return plan;
    });
  }

  async delete(
    id: string,
    ownerId: string,
    event: DomainEvent,
    now: Date,
    purgeAfter: Date,
  ): Promise<"DELETED" | "NOT_FOUND"> {
    return this.transaction(async (client) => {
      const changed = await client.query(
        "UPDATE itineraries SET deleted_at=$1,purge_after=$2,updated_at=$1,version=version+1 WHERE id=$3 AND owner_id=$4 AND deleted_at IS NULL",
        [now, purgeAfter, id, ownerId],
      );
      if (changed.rowCount !== 1) return "NOT_FOUND";
      await client.query(
        "UPDATE itinerary_items SET deleted_at=$1,updated_at=$1,version=version+1 WHERE itinerary_id=$2 AND deleted_at IS NULL",
        [now, id],
      );
      await client.query(
        "UPDATE reservations SET deleted_at=$1,updated_at=$1,version=version+1 WHERE itinerary_id=$2 AND deleted_at IS NULL",
        [now, id],
      );
      await client.query(
        "UPDATE travel_checklists SET deleted_at=$1,updated_at=$1,version=version+1 WHERE itinerary_id=$2 AND deleted_at IS NULL",
        [now, id],
      );
      await this.appendEvent(client, event);
      return "DELETED";
    });
  }

  private async insertAggregate(client: PoolClient, plan: PlanRecord): Promise<void> {
    await client.query(
      "INSERT INTO itineraries(id,owner_id,title,status,start_date,end_date,budget_amount,budget_currency,notes_ciphertext,created_at,updated_at,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11)",
      [
        plan.id,
        plan.ownerId,
        plan.title,
        plan.status,
        plan.startDate,
        plan.endDate,
        plan.budgetAmount,
        plan.budgetCurrency,
        this.encrypt(plan.notes),
        plan.createdAt,
        plan.version,
      ],
    );
    await this.syncChildren(client, plan);
  }
  private async syncChildren(client: PoolClient, plan: PlanRecord): Promise<void> {
    const now = plan.updatedAt;
    await this.upsertItems(client, plan, now);
    await this.upsertReservations(client, plan, now);
    await this.upsertChecklist(client, plan, now);
  }
  private async upsertItems(client: PoolClient, plan: PlanRecord, now: Date): Promise<void> {
    const ids = plan.items.map((v) => v.id);
    await client.query(
      "UPDATE itinerary_items SET deleted_at=$1,updated_at=$1,version=version+1 WHERE itinerary_id=$2 AND deleted_at IS NULL AND NOT(id=ANY($3::uuid[]))",
      [now, plan.id, ids],
    );
    await client.query(
      "UPDATE itinerary_items SET position=position+1000000 WHERE itinerary_id=$1 AND deleted_at IS NULL",
      [plan.id],
    );
    for (const value of plan.items)
      await client.query(
        "INSERT INTO itinerary_items(id,itinerary_id,position,title,starts_at,ends_at,location_reference,notes_ciphertext,status,created_at,updated_at,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11) ON CONFLICT(id) DO UPDATE SET position=$3,title=$4,starts_at=$5,ends_at=$6,location_reference=$7,notes_ciphertext=$8,status=$9,updated_at=$10,version=$11",
        [
          value.id,
          plan.id,
          value.position,
          value.title,
          value.startsAt,
          value.endsAt,
          value.locationReference,
          this.encrypt(value.notes),
          value.status,
          now,
          value.version,
        ],
      );
  }
  private async upsertReservations(client: PoolClient, plan: PlanRecord, now: Date): Promise<void> {
    const ids = plan.reservations.map((v) => v.id);
    await client.query(
      "UPDATE reservations SET deleted_at=$1,updated_at=$1,version=version+1 WHERE itinerary_id=$2 AND deleted_at IS NULL AND NOT(id=ANY($3::uuid[]))",
      [now, plan.id, ids],
    );
    for (const value of plan.reservations)
      await client.query(
        "INSERT INTO reservations(id,itinerary_id,provider_name,reference_ciphertext,starts_at,ends_at,status,created_at,updated_at,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,$9) ON CONFLICT(id) DO UPDATE SET provider_name=$3,reference_ciphertext=$4,starts_at=$5,ends_at=$6,status=$7,updated_at=$8,version=$9",
        [
          value.id,
          plan.id,
          value.providerName,
          this.encrypt(value.reference),
          value.startsAt,
          value.endsAt,
          value.status,
          now,
          value.version,
        ],
      );
  }
  private async upsertChecklist(client: PoolClient, plan: PlanRecord, now: Date): Promise<void> {
    const ids = plan.checklistItems.map((v) => v.id);
    await client.query(
      "UPDATE travel_checklists SET deleted_at=$1,updated_at=$1,version=version+1 WHERE itinerary_id=$2 AND deleted_at IS NULL AND NOT(id=ANY($3::uuid[]))",
      [now, plan.id, ids],
    );
    await client.query(
      "UPDATE travel_checklists SET position=position+1000000 WHERE itinerary_id=$1 AND deleted_at IS NULL",
      [plan.id],
    );
    for (const value of plan.checklistItems)
      await client.query(
        "INSERT INTO travel_checklists(id,itinerary_id,position,title,status,completed_at,created_at,updated_at,version) VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8) ON CONFLICT(id) DO UPDATE SET position=$3,title=$4,status=$5,completed_at=$6,updated_at=$7,version=$8",
        [
          value.id,
          plan.id,
          value.position,
          value.title,
          value.status,
          value.status === "COMPLETE" ? now : null,
          now,
          value.version,
        ],
      );
  }
  private async hydrate(row: QueryResultRow): Promise<PlanRecord> {
    const [items, reservations, checklist] = await Promise.all([
      this.pool.query(
        "SELECT * FROM itinerary_items WHERE itinerary_id=$1 AND deleted_at IS NULL ORDER BY position,id",
        [row.id],
      ),
      this.pool.query(
        "SELECT * FROM reservations WHERE itinerary_id=$1 AND deleted_at IS NULL ORDER BY created_at,id",
        [row.id],
      ),
      this.pool.query(
        "SELECT * FROM travel_checklists WHERE itinerary_id=$1 AND deleted_at IS NULL ORDER BY position,id",
        [row.id],
      ),
    ]);
    return {
      id: String(row.id),
      ownerId: String(row.owner_id),
      title: String(row.title),
      status: row.status as PlanRecord["status"],
      startDate: row.start_date === null ? null : isoDate(row.start_date),
      endDate: row.end_date === null ? null : isoDate(row.end_date),
      budgetAmount: row.budget_amount === null ? null : String(row.budget_amount),
      budgetCurrency: row.budget_currency === null ? null : String(row.budget_currency),
      notes: this.decrypt(row.notes_ciphertext),
      items: items.rows.map((v) => ({
        id: String(v.id),
        title: String(v.title),
        startsAt: v.starts_at as Date | null,
        endsAt: v.ends_at as Date | null,
        locationReference: v.location_reference as string | null,
        notes: this.decrypt(v.notes_ciphertext),
        status: v.status,
        position: Number(v.position),
        version: Number(v.version),
      })),
      reservations: reservations.rows.map((v) => ({
        id: String(v.id),
        providerName: String(v.provider_name),
        reference: this.decrypt(v.reference_ciphertext),
        startsAt: v.starts_at as Date | null,
        endsAt: v.ends_at as Date | null,
        status: v.status,
        version: Number(v.version),
      })),
      checklistItems: checklist.rows.map((v) => ({
        id: String(v.id),
        title: String(v.title),
        status: v.status,
        position: Number(v.position),
        version: Number(v.version),
      })),
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
      version: Number(row.version),
    };
  }
  private async appendEvent(client: PoolClient, event: DomainEvent): Promise<void> {
    await client.query(
      "INSERT INTO outbox_events(event_id,event_type,event_version,subject_type,subject_id,subject_version,partition_key,payload,occurred_at,available_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$9)",
      [
        event.eventId,
        event.eventType,
        event.eventVersion,
        event.subjectType,
        event.subjectId,
        event.subjectVersion,
        event.ownerId,
        event,
        event.occurredAt,
      ],
    );
  }
  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const value = await work(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      if (error instanceof ConflictException) throw error;
      throw new InfrastructureException(
        "DATABASE_UNAVAILABLE",
        "Planning persistence is unavailable.",
        { cause: error, retryable: true },
      );
    } finally {
      client.release();
    }
  }
  private encrypt(value: string | null): Buffer | null {
    return value === null ? null : this.encryption.encrypt(value);
  }
  private decrypt(value: Buffer | null): string | null {
    return value === null ? null : this.encryption.decrypt(value);
  }
}
function isoDate(value: unknown): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}
