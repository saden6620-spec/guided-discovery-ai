import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  ApplicationException,
  AuthorizationException,
  ConflictException,
} from "@guided-discovery/errors";
import {
  ENCRYPTION_ADAPTER,
  PERMISSION_GATEWAY,
  RECOMMENDATION_REPOSITORY,
  type EncryptionAdapter,
  type PermissionGateway,
  type RecommendationRepository,
} from "./ports.js";
import {
  toResource,
  type Principal,
  type RecommendationResource,
  type RecommendationStatus,
} from "../domain/recommendation.js";
import type { CreateRecommendationDto } from "../presentation/schemas.js";
export interface RequestExecutionContext {
  principal: Principal;
  requestId: string;
  correlationId: string;
}
@Injectable()
export class RecommendationApplicationService {
  constructor(
    @Inject(RECOMMENDATION_REPOSITORY) private readonly repo: RecommendationRepository,
    @Inject(PERMISSION_GATEWAY) private readonly permissions: PermissionGateway,
    @Inject(ENCRYPTION_ADAPTER) private readonly encryption: EncryptionAdapter,
  ) {}
  async list(
    ctx: RequestExecutionContext,
    q: {
      limit: number;
      cursor?: string | undefined;
      category?: string | undefined;
      status?: RecommendationStatus | undefined;
    },
  ) {
    await this.permissions.authorize({
      principal: ctx.principal,
      action: "READ",
      resourceId: null,
      ownerId: ctx.principal.id,
      purpose: "recommendation.list",
      permissionPolicyRef: "recommendation.owner.v1",
      requestedPermissionVersion: 1,
    });
    const before = q.cursor
      ? this.decodeCursor(q.cursor, ctx.principal.id, q.category, q.status)
      : undefined;
    let rows = await this.repo.list(ctx.principal.id, {
      limit: q.limit + 1,
      ...(q.category ? { category: q.category } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(before ? { before } : {}),
    });
    const authorizedRows = [];
    for (const row of rows) {
      try {
        await this.permissions.authorize({
          principal: ctx.principal,
          action: "READ",
          resourceId: row.id,
          ownerId: row.ownerId,
          purpose: "recommendation.read",
          permissionPolicyRef: row.permissionPolicyRef,
          requestedPermissionVersion: row.permissionVersion,
        });
        authorizedRows.push(row);
      } catch (error) {
        if (error instanceof AuthorizationException && error.code === "ACCESS_DENIED") continue;
        throw error;
      }
    }
    rows = authorizedRows;
    for (const row of rows.filter(
      (r) => r.status === "AVAILABLE" && r.expiresAt !== null && r.expiresAt <= new Date(),
    ))
      await this.repo.transition({
        id: row.id,
        ownerId: row.ownerId,
        toStatus: "EXPIRED",
        expectedVersion: row.version,
        actorType: "SYSTEM",
        actorId: null,
      });
    rows = rows.filter(
      (r) => !(r.status === "AVAILABLE" && r.expiresAt !== null && r.expiresAt <= new Date()),
    );
    const hasMore = rows.length > q.limit,
      selected = rows.slice(0, q.limit),
      last = selected.at(-1);
    return {
      data: selected.map(toResource),
      metadata: {
        nextCursor:
          hasMore && last
            ? this.encodeCursor(last.availableAt, last.id, ctx.principal.id, q.category, q.status)
            : null,
        hasMore,
        limit: q.limit,
      },
    };
  }
  async act(
    ctx: RequestExecutionContext,
    id: string,
    expectedVersion: number,
    key: string,
    toStatus: "ACCEPTED" | "DISMISSED",
  ) {
    const current = await this.repo.get(id, ctx.principal.id);
    if (!current) throw this.notFound();
    await this.permissions.authorize({
      principal: ctx.principal,
      action: "UPDATE",
      resourceId: id,
      ownerId: ctx.principal.id,
      purpose: `recommendation.${toStatus.toLowerCase()}`,
      permissionPolicyRef: current.permissionPolicyRef,
      requestedPermissionVersion: current.permissionVersion,
    });
    if (current.expiresAt !== null && current.expiresAt <= new Date()) {
      if (current.status === "AVAILABLE")
        await this.repo.transition({
          id,
          ownerId: ctx.principal.id,
          toStatus: "EXPIRED",
          expectedVersion: current.version,
          actorType: "SYSTEM",
          actorId: null,
        });
      throw new ConflictException("RECOMMENDATION_EXPIRED", "Recommendation has expired.");
    }
    const scope = this.scope(
      ctx,
      key,
      `/api/v1/recommendations/{id}/${toStatus === "ACCEPTED" ? "accept" : "dismiss"}`,
      { id, expectedVersion },
    );
    const result = await this.repo.transition({
      id,
      ownerId: ctx.principal.id,
      toStatus,
      expectedVersion,
      actorType: "USER",
      actorId: ctx.principal.id,
      scope,
      response: Buffer.from("{}"),
    });
    return Buffer.isBuffer(result)
      ? (JSON.parse(this.encryption.decrypt(result)) as RecommendationResource)
      : toResource(result);
  }
  async create(ctx: RequestExecutionContext, dto: CreateRecommendationDto, key: string) {
    if (!ctx.principal.scopes.has("recommendation.ingest"))
      throw new ApplicationException({
        code: "PRODUCER_NOT_ALLOWED",
        message: "Producer is not allowed.",
        httpStatus: 403,
      });
    if (dto.provenance.producer !== ctx.principal.id)
      throw new ApplicationException({
        code: "PRODUCER_NOT_ALLOWED",
        message: "Producer identity does not match provenance.",
        httpStatus: 403,
      });
    if (
      dto.expiresAt !== null &&
      dto.expiresAt !== undefined &&
      new Date(dto.expiresAt) <= new Date()
    )
      throw new ApplicationException({
        code: "VALIDATION_FAILED",
        message: "expiresAt must be in the future.",
        httpStatus: 422,
      });
    const decision = await this.permissions.authorize({
      principal: ctx.principal,
      action: "CREATE",
      resourceId: null,
      ownerId: dto.ownerId,
      purpose: "recommendation.ingest",
      permissionPolicyRef: dto.permissionPolicyRef,
      requestedPermissionVersion: dto.permissionVersion,
    });
    if (
      decision.policyRef !== dto.permissionPolicyRef ||
      decision.permissionVersion !== dto.permissionVersion
    )
      throw new ApplicationException({
        code: "ACCESS_DENIED",
        message: "Permission policy is stale or invalid.",
        httpStatus: 403,
      });
    const now = new Date(),
      id = randomUUID(),
      record = {
        id,
        ownerId: dto.ownerId,
        category: dto.category,
        title: dto.title,
        summary: dto.summary,
        rationale: dto.rationale,
        status: "AVAILABLE" as const,
        confidence: dto.confidence,
        availableAt: new Date(dto.availableAt),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        permissionPolicyRef: decision.policyRef,
        permissionVersion: decision.permissionVersion,
        provenance: {
          ...dto.provenance,
          sourceResourceId: dto.provenance.sourceResourceId ?? null,
        },
        scores: dto.scores,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        purgeAfter: null,
        version: 1,
      };
    const scope = this.scope(ctx, key, "/internal/v1/recommendations", dto),
      result = await this.repo.create(
        record,
        scope,
        this.encryption.encrypt(JSON.stringify(toResource(record))),
      );
    return Buffer.isBuffer(result)
      ? (JSON.parse(this.encryption.decrypt(result)) as RecommendationResource)
      : toResource(result);
  }
  private scope(c: RequestExecutionContext, key: string, routeTemplate: string, body: unknown) {
    return {
      principalId: c.principal.id,
      routeTemplate,
      keyHash: createHash("sha256").update(key).digest("hex"),
      requestHash: createHash("sha256").update(JSON.stringify(body)).digest("hex"),
    };
  }
  private encodeCursor(at: Date, id: string, owner: string, category?: string, status?: string) {
    const body = Buffer.from(
        JSON.stringify({
          at: at.toISOString(),
          id,
          owner,
          category: category ?? null,
          status: status ?? null,
          exp: Date.now() + 900000,
        }),
      ).toString("base64url"),
      sig = createHmac(
        "sha256",
        process.env.CURSOR_SIGNING_KEY ?? "recommendation-cursor-development-key",
      )
        .update(body)
        .digest("base64url");
    return `${body}.${sig}`;
  }
  private decodeCursor(cursor: string, owner: string, category?: string, status?: string) {
    try {
      const [b, s] = cursor.split(".");
      if (!b || !s) throw 0;
      const expected = createHmac(
        "sha256",
        process.env.CURSOR_SIGNING_KEY ?? "recommendation-cursor-development-key",
      )
        .update(b)
        .digest();
      const actual = Buffer.from(s, "base64url");
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw 0;
      const v = JSON.parse(Buffer.from(b, "base64url").toString()) as {
        at: string;
        id: string;
        owner: string;
        category: string | null;
        status: string | null;
        exp: number;
      };
      if (
        v.owner !== owner ||
        v.category !== (category ?? null) ||
        v.status !== (status ?? null) ||
        v.exp < Date.now()
      )
        throw 0;
      return { availableAt: new Date(v.at), id: v.id };
    } catch {
      throw new ApplicationException({
        code: "INVALID_CURSOR",
        message: "Cursor is invalid.",
        httpStatus: 400,
      });
    }
  }
  private notFound() {
    return new ApplicationException({
      code: "RESOURCE_NOT_FOUND",
      message: "Recommendation was not found.",
      httpStatus: 404,
    });
  }
}
