import { Inject, Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { ConflictException, InfrastructureException } from "@guided-discovery/errors";
import type { DomainEvent } from "@guided-discovery/events";
import type { DestinationRecord, NavigationRecord, RouteRecord } from "../domain/navigation.js";
import {
  ENCRYPTION_ADAPTER,
  type EncryptionAdapter,
  type IdempotencyReplay,
  type IdempotencyScope,
  type NavigationRepository,
} from "../application/ports.js";
@Injectable()
export class PostgresNavigationRepository implements NavigationRepository, OnApplicationShutdown {
  private readonly pool = new Pool({
    connectionString: process.env.NAVIGATION_DATABASE_URL ?? process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  });
  constructor(@Inject(ENCRYPTION_ADAPTER) private readonly encryption: EncryptionAdapter) {}
  async onApplicationShutdown() {
    await this.close();
  }
  async close() {
    await this.pool.end();
  }
  async ping(signal: AbortSignal) {
    signal.throwIfAborted();
    await this.pool.query("SELECT 1");
  }
  async schemaIsCurrent(signal: AbortSignal) {
    signal.throwIfAborted();
    const result = await this.pool.query(
      "SELECT to_regclass('public.navigation_sessions') IS NOT NULL AS current",
    );
    return result.rows[0]?.current === true;
  }
  async getSession(id: string, ownerId: string) {
    const result = await this.pool.query(
      "SELECT s.*,t.state trip_state,t.created_at trip_created_at FROM navigation_sessions s JOIN trips t ON t.id=s.trip_id WHERE s.id=$1 AND s.owner_id=$2 AND s.deleted_at IS NULL AND t.deleted_at IS NULL",
      [id, ownerId],
    );
    return result.rowCount === 0 ? null : this.navigation(result.rows[0] as QueryResultRow);
  }
  async getActive(ownerId: string) {
    const result = await this.pool.query(
      "SELECT s.*,t.state trip_state,t.created_at trip_created_at FROM navigation_sessions s JOIN trips t ON t.id=s.trip_id WHERE s.owner_id=$1 AND s.state='ACTIVE' AND s.deleted_at IS NULL AND t.deleted_at IS NULL",
      [ownerId],
    );
    return result.rowCount === 0 ? null : this.navigation(result.rows[0] as QueryResultRow);
  }
  async getDestination(id: string) {
    const result = await this.pool.query(
      "SELECT * FROM destinations WHERE id=$1 AND deleted_at IS NULL",
      [id],
    );
    return result.rowCount === 0 ? null : this.destination(result.rows[0] as QueryResultRow);
  }
  async getRoute(id: string) {
    const result = await this.pool.query(
      "SELECT * FROM routes WHERE id=$1 AND deleted_at IS NULL",
      [id],
    );
    return result.rowCount === 0 ? null : this.route(result.rows[0] as QueryResultRow);
  }
  async start(
    record: NavigationRecord,
    events: readonly DomainEvent[],
    scope: IdempotencyScope,
    response: Buffer,
  ): Promise<NavigationRecord | IdempotencyReplay> {
    return this.transaction(async (client) => {
      const prior = await client.query(
        "SELECT request_hash,state,response_body FROM idempotency_records WHERE environment=$1 AND principal_id=$2 AND service='navigation-service' AND method='POST' AND route_template=$3 AND key_hash=$4 FOR UPDATE",
        [scope.environment, scope.principalId, scope.routeTemplate, scope.keyHash],
      );
      if ((prior.rowCount ?? 0) > 0) {
        const row = prior.rows[0] as QueryResultRow;
        return {
          requestHash: String(row.request_hash),
          state: String(row.state) as "IN_PROGRESS" | "COMPLETED",
          responseBody: row.response_body as Buffer | null,
        };
      }
      await client.query(
        "INSERT INTO idempotency_records(id,environment,principal_id,service,method,route_template,key_hash,request_hash,state,created_at,expires_at) VALUES($1,$2,$3,'navigation-service','POST',$4,$5,$6,'IN_PROGRESS',$7,$8)",
        [
          crypto.randomUUID(),
          scope.environment,
          scope.principalId,
          scope.routeTemplate,
          scope.keyHash,
          scope.requestHash,
          record.createdAt,
          new Date(record.createdAt.getTime() + 30 * 86400000),
        ],
      );
      const active = await client.query(
        "SELECT id FROM trips WHERE owner_id=$1 AND state='ACTIVE' AND deleted_at IS NULL FOR UPDATE",
        [record.ownerId],
      );
      if ((active.rowCount ?? 0) > 0)
        throw new ConflictException("NAVIGATION_ALREADY_ACTIVE", "Navigation is already active.");
      await client.query(
        "INSERT INTO trips(id,owner_id,state,destination_id,started_at,created_at,updated_at,version) VALUES($1,$2,'ACTIVE',$3,$4,$4,$4,1)",
        [record.tripId, record.ownerId, record.destinationId, record.startedAt],
      );
      await client.query(
        "INSERT INTO navigation_sessions(id,trip_id,owner_id,route_id,destination_id,travel_mode,state,started_at,created_at,updated_at,version) VALUES($1,$2,$3,$4,$5,$6,'ACTIVE',$7,$7,$7,1)",
        [
          record.id,
          record.tripId,
          record.ownerId,
          record.routeId,
          record.destinationId,
          record.travelMode,
          record.startedAt,
        ],
      );
      await client.query("UPDATE trips SET active_session_id=$1 WHERE id=$2", [
        record.id,
        record.tripId,
      ]);
      for (const event of events) await this.appendEvent(client, event);
      await client.query(
        "UPDATE idempotency_records SET state='COMPLETED',response_status=201,response_body=$1,completed_at=$2 WHERE environment=$3 AND principal_id=$4 AND service='navigation-service' AND route_template=$5 AND key_hash=$6",
        [
          response,
          record.createdAt,
          scope.environment,
          scope.principalId,
          scope.routeTemplate,
          scope.keyHash,
        ],
      );
      return record;
    });
  }
  async stop(
    id: string,
    ownerId: string,
    outcome: "COMPLETED" | "CANCELLED",
    expectedVersion: number,
    now: Date,
    events: readonly DomainEvent[],
    scope: IdempotencyScope,
    response: Buffer,
  ) {
    return this.transaction(async (client) => {
      const replay = await this.findIdempotency(client, scope);
      if (replay !== null) return replay;
      await this.beginIdempotency(client, scope, now);
      const changed = await client.query(
        "UPDATE navigation_sessions SET state=$1,ended_at=$2,stop_reason=$1,updated_at=$2,version=version+1 WHERE id=$3 AND owner_id=$4 AND state='ACTIVE' AND version=$5 RETURNING *",
        [outcome, now, id, ownerId, expectedVersion],
      );
      if (changed.rowCount !== 1)
        throw new ConflictException("VERSION_CONFLICT", "The navigation version has changed.");
      const session = changed.rows[0] as QueryResultRow;
      await client.query(
        "UPDATE trips SET state=$1::varchar,active_session_id=NULL,completed_at=CASE WHEN $1::varchar='COMPLETED' THEN $2::timestamptz ELSE NULL::timestamptz END,cancelled_at=CASE WHEN $1::varchar='CANCELLED' THEN $2::timestamptz ELSE NULL::timestamptz END,outcome=$1::varchar,updated_at=$2::timestamptz,version=version+1 WHERE id=$3",
        [outcome, now, session.trip_id],
      );
      for (const event of events) await this.appendEvent(client, event);
      await this.completeIdempotency(client, scope, response, now);
      return (await this.getWithin(client, id, ownerId)) as NavigationRecord;
    });
  }
  async reroute(
    id: string,
    ownerId: string,
    routeId: string,
    expectedVersion: number,
    now: Date,
    event: DomainEvent,
    scope: IdempotencyScope,
    response: Buffer,
  ) {
    return this.transaction(async (client) => {
      const replay = await this.findIdempotency(client, scope);
      if (replay !== null) return replay;
      await this.beginIdempotency(client, scope, now);
      const changed = await client.query(
        "UPDATE navigation_sessions SET route_id=$1,updated_at=$2,version=version+1 WHERE id=$3 AND owner_id=$4 AND state='ACTIVE' AND version=$5",
        [routeId, now, id, ownerId, expectedVersion],
      );
      if (changed.rowCount !== 1)
        throw new ConflictException("VERSION_CONFLICT", "The navigation version has changed.");
      await this.appendEvent(client, event);
      await this.completeIdempotency(client, scope, response, now);
      return (await this.getWithin(client, id, ownerId)) as NavigationRecord;
    });
  }
  async upsertDestination(value: DestinationRecord) {
    return this.transaction(async (client) => {
      const existing = await client.query("SELECT * FROM destinations WHERE id=$1 FOR UPDATE", [
        value.id,
      ]);
      if ((existing.rowCount ?? 0) > 0) {
        const current = this.destination(existing.rows[0] as QueryResultRow);
        if (
          value.sourceVersion < current.sourceVersion ||
          (value.sourceVersion === current.sourceVersion &&
            JSON.stringify(value) !== JSON.stringify(current))
        )
          throw new ConflictException("STALE_SOURCE_VERSION", "The source version is stale.");
        if (value.sourceVersion === current.sourceVersion)
          return { record: current, created: false };
        await client.query(
          "UPDATE destinations SET provider=$1,provider_reference=$2,name=$3,latitude=$4,longitude=$5,timezone=$6,accessibility=$7,source_version=$8,updated_at=now(),version=version+1,deleted_at=NULL WHERE id=$9",
          [
            value.provider,
            value.providerReference,
            value.name,
            value.latitude,
            value.longitude,
            value.timezone,
            value.accessibility,
            value.sourceVersion,
            value.id,
          ],
        );
        return {
          record: (await this.getDestinationWithin(client, value.id)) as DestinationRecord,
          created: false,
        };
      }
      await client.query(
        "INSERT INTO destinations(id,owner_id,provider,provider_reference,name,latitude,longitude,timezone,accessibility,source_version,created_at,updated_at,version) VALUES($1,NULL,$2,$3,$4,$5,$6,$7,$8,$9,now(),now(),1)",
        [
          value.id,
          value.provider,
          value.providerReference,
          value.name,
          value.latitude,
          value.longitude,
          value.timezone,
          value.accessibility,
          value.sourceVersion,
        ],
      );
      return { record: value, created: true };
    });
  }
  async upsertRoute(value: RouteRecord) {
    return this.transaction(async (client) => {
      const existing = await client.query("SELECT * FROM routes WHERE id=$1 FOR UPDATE", [
        value.id,
      ]);
      if ((existing.rowCount ?? 0) > 0) {
        const current = this.route(existing.rows[0] as QueryResultRow);
        if (
          value.sourceVersion < current.sourceVersion ||
          (value.sourceVersion === current.sourceVersion &&
            JSON.stringify(value) !== JSON.stringify(current))
        )
          throw new ConflictException("STALE_SOURCE_VERSION", "The source version is stale.");
        if (value.sourceVersion === current.sourceVersion)
          return { record: current, created: false };
        await client.query(
          "UPDATE routes SET provider=$1,provider_reference=$2,origin_destination_id=$3,destination_id=$4,travel_mode=$5,distance_meters=$6,duration_seconds=$7,polyline_ciphertext=$8,accessibility=$9,valid_from=$10,valid_until=$11,source_version=$12,updated_at=now(),version=version+1,deleted_at=NULL WHERE id=$13",
          [
            value.provider,
            value.providerReference,
            value.originDestinationId,
            value.destinationId,
            value.travelMode,
            value.distanceMeters,
            value.durationSeconds,
            this.encryption.encrypt(value.polyline),
            value.accessibility,
            value.validFrom,
            value.validUntil,
            value.sourceVersion,
            value.id,
          ],
        );
        return {
          record: (await this.getRouteWithin(client, value.id)) as RouteRecord,
          created: false,
        };
      }
      await client.query(
        "INSERT INTO routes(id,owner_id,provider,provider_reference,origin_destination_id,destination_id,travel_mode,distance_meters,duration_seconds,polyline_ciphertext,accessibility,valid_from,valid_until,source_version,created_at,updated_at,version) VALUES($1,NULL,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),now(),1)",
        [
          value.id,
          value.provider,
          value.providerReference,
          value.originDestinationId,
          value.destinationId,
          value.travelMode,
          value.distanceMeters,
          value.durationSeconds,
          this.encryption.encrypt(value.polyline),
          value.accessibility,
          value.validFrom,
          value.validUntil,
          value.sourceVersion,
        ],
      );
      return { record: value, created: true };
    });
  }
  private async getWithin(client: PoolClient, id: string, ownerId: string) {
    const result = await client.query(
      "SELECT s.*,t.state trip_state,t.created_at trip_created_at FROM navigation_sessions s JOIN trips t ON t.id=s.trip_id WHERE s.id=$1 AND s.owner_id=$2 AND s.deleted_at IS NULL AND t.deleted_at IS NULL",
      [id, ownerId],
    );
    return result.rowCount === 0 ? null : this.navigation(result.rows[0] as QueryResultRow);
  }
  private async getDestinationWithin(client: PoolClient, id: string) {
    const r = await client.query("SELECT * FROM destinations WHERE id=$1 AND deleted_at IS NULL", [
      id,
    ]);
    return r.rowCount === 0 ? null : this.destination(r.rows[0] as QueryResultRow);
  }
  private async getRouteWithin(client: PoolClient, id: string) {
    const r = await client.query("SELECT * FROM routes WHERE id=$1 AND deleted_at IS NULL", [id]);
    return r.rowCount === 0 ? null : this.route(r.rows[0] as QueryResultRow);
  }
  private navigation(row: QueryResultRow): NavigationRecord {
    return {
      id: String(row.id),
      tripId: String(row.trip_id),
      ownerId: String(row.owner_id),
      destinationId: String(row.destination_id),
      routeId: String(row.route_id),
      travelMode: row.travel_mode,
      tripState: row.trip_state,
      sessionState: row.state,
      startedAt: row.started_at as Date,
      stoppedAt: row.ended_at as Date | null,
      stopReason: row.stop_reason,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
      version: Number(row.version),
    };
  }
  private destination(row: QueryResultRow): DestinationRecord {
    return {
      id: String(row.id),
      ownerId: row.owner_id === null ? null : String(row.owner_id),
      provider: String(row.provider),
      providerReference: String(row.provider_reference),
      name: String(row.name),
      latitude: String(row.latitude),
      longitude: String(row.longitude),
      timezone: String(row.timezone),
      accessibility: row.accessibility as Record<string, unknown>,
      sourceVersion: Number(row.source_version),
      version: Number(row.version),
    };
  }
  private route(row: QueryResultRow): RouteRecord {
    return {
      id: String(row.id),
      ownerId: row.owner_id === null ? null : String(row.owner_id),
      provider: String(row.provider),
      providerReference: String(row.provider_reference),
      originDestinationId: String(row.origin_destination_id),
      destinationId: String(row.destination_id),
      travelMode: row.travel_mode,
      distanceMeters: Number(row.distance_meters),
      durationSeconds: Number(row.duration_seconds),
      polyline: this.encryption.decrypt(row.polyline_ciphertext as Buffer),
      accessibility: row.accessibility as Record<string, unknown>,
      validFrom: row.valid_from as Date,
      validUntil: row.valid_until as Date | null,
      sourceVersion: Number(row.source_version),
      version: Number(row.version),
    };
  }
  private async appendEvent(client: PoolClient, event: DomainEvent) {
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
  private async findIdempotency(
    client: PoolClient,
    scope: IdempotencyScope,
  ): Promise<IdempotencyReplay | null> {
    const result = await client.query(
      "SELECT request_hash,state,response_body FROM idempotency_records WHERE environment=$1 AND principal_id=$2 AND service='navigation-service' AND method='POST' AND route_template=$3 AND key_hash=$4 FOR UPDATE",
      [scope.environment, scope.principalId, scope.routeTemplate, scope.keyHash],
    );
    if ((result.rowCount ?? 0) === 0) return null;
    const row = result.rows[0] as QueryResultRow;
    return {
      requestHash: String(row.request_hash),
      state: String(row.state) as "IN_PROGRESS" | "COMPLETED",
      responseBody: row.response_body as Buffer | null,
    };
  }
  private async beginIdempotency(
    client: PoolClient,
    scope: IdempotencyScope,
    now: Date,
  ): Promise<void> {
    await client.query(
      "INSERT INTO idempotency_records(id,environment,principal_id,service,method,route_template,key_hash,request_hash,state,created_at,expires_at) VALUES($1,$2,$3,'navigation-service','POST',$4,$5,$6,'IN_PROGRESS',$7,$8)",
      [
        crypto.randomUUID(),
        scope.environment,
        scope.principalId,
        scope.routeTemplate,
        scope.keyHash,
        scope.requestHash,
        now,
        new Date(now.getTime() + 30 * 86400000),
      ],
    );
  }
  private async completeIdempotency(
    client: PoolClient,
    scope: IdempotencyScope,
    response: Buffer,
    now: Date,
  ): Promise<void> {
    await client.query(
      "UPDATE idempotency_records SET state='COMPLETED',response_status=200,response_body=$1,completed_at=$2 WHERE environment=$3 AND principal_id=$4 AND service='navigation-service' AND method='POST' AND route_template=$5 AND key_hash=$6",
      [response, now, scope.environment, scope.principalId, scope.routeTemplate, scope.keyHash],
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
      if ((error as { code?: string }).code === "23505")
        throw new ConflictException("NAVIGATION_ALREADY_ACTIVE", "Navigation is already active.");
      throw new InfrastructureException(
        "DATABASE_UNAVAILABLE",
        "Navigation persistence is unavailable.",
        { cause: error, retryable: true },
      );
    } finally {
      client.release();
    }
  }
}
