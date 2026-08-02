import { randomUUID } from "node:crypto";
import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Pool, type PoolClient } from "pg";
import { ApplicationException, ConflictException } from "@guided-discovery/errors";
import {
  ENCRYPTION_ADAPTER,
  type EncryptionAdapter,
  type IdempotencyScope,
  type RecommendationRepository,
} from "../application/ports.js";
import type { RecommendationRecord, RecommendationStatus } from "../domain/recommendation.js";
type Row = {
  id: string;
  owner_id: string;
  category: string;
  title_ciphertext: Buffer;
  summary_ciphertext: Buffer;
  rationale_ciphertext: Buffer;
  status: RecommendationStatus;
  confidence: string;
  available_at: Date;
  expires_at: Date | null;
  permission_policy_ref: string;
  permission_version: number;
  provenance: RecommendationRecord["provenance"];
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  purge_after: Date | null;
  version: number;
};
@Injectable()
export class PostgresRecommendationRepository implements RecommendationRepository, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.RECOMMENDATION_DATABASE_URL ?? process.env.DATABASE_URL,
    connectionTimeoutMillis: 1000,
    max: 10,
  });
  constructor(@Inject(ENCRYPTION_ADAPTER) private readonly encryption: EncryptionAdapter) {}
  async list(
    ownerId: string,
    input: {
      limit: number;
      category?: string;
      status?: RecommendationStatus;
      before?: { availableAt: Date; id: string };
    },
  ) {
    const values: unknown[] = [ownerId];
    let where = "owner_id=$1 AND deleted_at IS NULL";
    if (input.category) {
      values.push(input.category);
      where += ` AND category=$${values.length}`;
    }
    if (input.status) {
      values.push(input.status);
      where += ` AND status=$${values.length}`;
    }
    if (input.before) {
      values.push(input.before.availableAt, input.before.id);
      where += ` AND (available_at,id)<($${values.length - 1},$${values.length})`;
    }
    values.push(input.limit);
    const result = await this.pool.query<Row>(
      `SELECT * FROM recommendations WHERE ${where} ORDER BY available_at DESC,id DESC LIMIT $${values.length}`,
      values,
    );
    return Promise.all(result.rows.map((r) => this.map(r)));
  }
  async get(id: string, ownerId: string) {
    const r = await this.pool.query<Row>(
      "SELECT * FROM recommendations WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL",
      [id, ownerId],
    );
    return r.rows[0] ? this.map(r.rows[0]) : null;
  }
  async create(v: RecommendationRecord, s: IdempotencyScope, response: Buffer) {
    return this.transaction(async (c) => {
      const replay = await this.claim(c, s);
      if (replay) return replay;
      await c.query(
        "INSERT INTO recommendations VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NULL,NULL,$16)",
        [
          v.id,
          v.ownerId,
          v.category,
          this.encryption.encrypt(v.title),
          this.encryption.encrypt(v.summary),
          this.encryption.encrypt(v.rationale),
          v.status,
          v.confidence,
          v.availableAt,
          v.expiresAt,
          v.permissionPolicyRef,
          v.permissionVersion,
          JSON.stringify(v.provenance),
          v.createdAt,
          v.updatedAt,
          v.version,
        ],
      );
      for (const score of v.scores)
        await c.query("INSERT INTO recommendation_scores VALUES($1,$2,$3,$4,$5,$6)", [
          randomUUID(),
          v.id,
          score.factor,
          score.score,
          v.provenance.sourceVersion,
          v.createdAt,
        ]);
      await this.history(c, v, null, "AVAILABLE", "SERVICE", v.provenance.producer, v.version);
      await this.complete(c, s, response, 201);
      return v;
    });
  }
  async transition(input: {
    id: string;
    ownerId: string;
    toStatus: "ACCEPTED" | "DISMISSED" | "EXPIRED";
    expectedVersion: number;
    actorType: "USER" | "SYSTEM";
    actorId: string | null;
    scope?: IdempotencyScope;
    response?: Buffer;
  }) {
    return this.transaction(async (c) => {
      if (input.scope) await this.claim(c, input.scope);
      const found = await c.query<Row>(
        "SELECT * FROM recommendations WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL FOR UPDATE",
        [input.id, input.ownerId],
      );
      const row = found.rows[0];
      if (!row)
        throw new ApplicationException({
          code: "RESOURCE_NOT_FOUND",
          message: "Recommendation was not found.",
          httpStatus: 404,
        });
      if (row.status === input.toStatus) {
        const mapped = await this.map(row);
        if (input.scope && input.response) await this.complete(c, input.scope, input.response, 200);
        return mapped;
      }
      if (row.status !== "AVAILABLE")
        throw new ConflictException(
          "RECOMMENDATION_ALREADY_RESOLVED",
          "Recommendation is already resolved.",
        );
      if (row.version !== input.expectedVersion)
        throw new ConflictException("VERSION_CONFLICT", "The expected version is stale.");
      const now = new Date(),
        version = row.version + 1;
      const updated = await c.query<Row>(
        "UPDATE recommendations SET status=$1,updated_at=$2,version=$3 WHERE id=$4 RETURNING *",
        [input.toStatus, now, version, input.id],
      );
      const eventId = await this.history(
        c,
        await this.map(updated.rows[0]!),
        "AVAILABLE",
        input.toStatus,
        input.actorType,
        input.actorId,
        version,
      );
      await this.outbox(
        c,
        await this.map(updated.rows[0]!),
        eventId,
        `Recommendation${input.toStatus[0]}${input.toStatus.slice(1).toLowerCase()}`,
        "AVAILABLE",
        input.toStatus,
        input.actorType,
        now,
      );
      const mapped = await this.map(updated.rows[0]!);
      if (input.scope && input.response) await this.complete(c, input.scope, input.response, 200);
      return mapped;
    });
  }
  private async history(
    c: PoolClient,
    v: RecommendationRecord,
    from: RecommendationStatus | null,
    to: RecommendationStatus,
    actorType: string,
    actorId: string | null,
    version: number,
  ) {
    const eventId = randomUUID();
    await c.query(
      "INSERT INTO recommendation_history VALUES($1,$2,$3,$4,$5,$6,$7,NULL,$8,$9,$10)",
      [
        randomUUID(),
        v.id,
        v.ownerId,
        from,
        to,
        actorType,
        actorId && /^[0-9a-f-]{36}$/iu.test(actorId) ? actorId : null,
        eventId,
        new Date(),
        version,
      ],
    );
    return eventId;
  }
  private async outbox(
    c: PoolClient,
    v: RecommendationRecord,
    eventId: string,
    eventType: string,
    from: RecommendationStatus,
    to: RecommendationStatus,
    actorType: string,
    now: Date,
  ) {
    await c.query(
      "INSERT INTO outbox_events VALUES($1,$2,1,'RECOMMENDATION',$3::uuid,$4,$3::text,$5,$6,$6,NULL,0,NULL,$6)",
      [
        eventId,
        eventType,
        v.id,
        v.version,
        JSON.stringify({
          eventId,
          eventType,
          eventVersion: 1,
          occurredAt: now.toISOString(),
          producer: "recommendation-service",
          subjectType: "RECOMMENDATION",
          subjectId: v.id,
          subjectVersion: v.version,
          actorId: null,
          ownerId: v.ownerId,
          correlationId: eventId,
          causationId: null,
          permissionVersion: v.permissionVersion,
          deletionVersion: null,
          payload: {
            recommendationId: v.id,
            fromStatus: from,
            toStatus: to,
            actorType,
            permissionPolicyRef: v.permissionPolicyRef,
            permissionVersion: v.permissionVersion,
            changedAt: now.toISOString(),
          },
        }),
        now,
      ],
    );
  }
  private async claim(c: PoolClient, s: IdempotencyScope) {
    const found = await c.query<{ request_hash: string; response_body: Buffer | null }>(
      "SELECT request_hash,response_body FROM idempotency_records WHERE environment=$1 AND principal_id=$2 AND service='recommendation-service' AND method='POST' AND route_template=$3 AND key_hash=$4 FOR UPDATE",
      [process.env.APP_ENV ?? "development", s.principalId, s.routeTemplate, s.keyHash],
    );
    if (found.rows[0]) {
      if (found.rows[0].request_hash !== s.requestHash)
        throw new ConflictException("IDEMPOTENCY_KEY_REUSED", "Idempotency key was reused.");
      return found.rows[0].response_body;
    }
    await c.query(
      "INSERT INTO idempotency_records VALUES($1,$2,$3,'recommendation-service','POST',$4,$5,$6,'IN_PROGRESS',NULL,NULL,NULL,$7,NULL,$8)",
      [
        randomUUID(),
        process.env.APP_ENV ?? "development",
        s.principalId,
        s.routeTemplate,
        s.keyHash,
        s.requestHash,
        new Date(),
        new Date(Date.now() + 30 * 86400000),
      ],
    );
    return null;
  }
  private async complete(c: PoolClient, s: IdempotencyScope, b: Buffer, status: number) {
    await c.query(
      "UPDATE idempotency_records SET state='COMPLETED',response_status=$1,response_body=$2,completed_at=$3 WHERE environment=$4 AND principal_id=$5 AND service='recommendation-service' AND route_template=$6 AND key_hash=$7",
      [
        status,
        b,
        new Date(),
        process.env.APP_ENV ?? "development",
        s.principalId,
        s.routeTemplate,
        s.keyHash,
      ],
    );
  }
  private async map(r: Row): Promise<RecommendationRecord> {
    const scores = await this.pool.query<{
      factor: RecommendationRecord["scores"][number]["factor"];
      score: string;
    }>(
      "SELECT factor,score FROM recommendation_scores WHERE recommendation_id=$1 ORDER BY factor",
      [r.id],
    );
    return {
      id: r.id,
      ownerId: r.owner_id,
      category: r.category,
      title: this.encryption.decrypt(r.title_ciphertext),
      summary: this.encryption.decrypt(r.summary_ciphertext),
      rationale: this.encryption.decrypt(r.rationale_ciphertext),
      status: r.status,
      confidence: Number(r.confidence),
      availableAt: r.available_at,
      expiresAt: r.expires_at,
      permissionPolicyRef: r.permission_policy_ref,
      permissionVersion: r.permission_version,
      provenance: r.provenance,
      scores: scores.rows.map((x) => ({ factor: x.factor, score: Number(x.score) })),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
      purgeAfter: r.purge_after,
      version: r.version,
    };
  }
  private async transaction<T>(fn: (c: PoolClient) => Promise<T>) {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const v = await fn(c);
      await c.query("COMMIT");
      return v;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  async ping(signal: AbortSignal) {
    if (signal.aborted) throw new Error("readiness_aborted");
    await this.pool.query("SELECT 1");
  }
  async schemaIsCurrent(signal: AbortSignal) {
    if (signal.aborted) throw new Error("readiness_aborted");
    const r = await this.pool.query<{ ok: boolean }>(
      "SELECT to_regclass('public.recommendations') IS NOT NULL AS ok",
    );
    return r.rows[0]?.ok ?? false;
  }
  async close() {
    await this.pool.end();
  }
  async onModuleDestroy() {
    await this.close();
  }
}
