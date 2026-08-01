import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";

import { ApplicationException, ConflictException } from "@guided-discovery/errors";
import type { DomainEvent } from "@guided-discovery/events";

import type { MemoryRecord, MemoryView, Principal, RelationshipType } from "../domain/memory.js";
import { SYMMETRIC_RELATIONSHIPS } from "../domain/memory.js";
import type {
  CreateMemoryDto,
  ListMemoriesQuery,
  UpdateMemoryDto,
} from "../presentation/schemas.js";
import {
  ENCRYPTION_ADAPTER,
  MEMORY_REPOSITORY,
  PERMISSION_GATEWAY,
  type EncryptionAdapter,
  type IdempotencyScope,
  type MemoryRepository,
  type PermissionGateway,
} from "./ports.js";

export interface RequestExecutionContext {
  readonly principal: Principal;
  readonly requestId: string;
  readonly correlationId: string;
}

@Injectable()
export class MemoryApplicationService {
  private readonly cursorCodec = new CursorCodec(
    process.env.CURSOR_SIGNING_KEY ?? "memory-development-cursor-signing-key-change-me",
  );
  private readonly environment = process.env.APP_ENV ?? "development";
  private readonly now = (): Date => new Date();

  constructor(
    @Inject(MEMORY_REPOSITORY) private readonly repository: MemoryRepository,
    @Inject(ENCRYPTION_ADAPTER) private readonly encryption: EncryptionAdapter,
    @Inject(PERMISSION_GATEWAY) private readonly permissions: PermissionGateway,
  ) {}

  async list(
    context: RequestExecutionContext,
    query: ListMemoriesQuery,
  ): Promise<{
    readonly data: readonly MemoryView[];
    readonly metadata: {
      readonly nextCursor: string | null;
      readonly hasMore: boolean;
      readonly limit: number;
    };
  }> {
    const cursor =
      query.cursor === undefined
        ? undefined
        : this.cursorCodec.decode(query.cursor, context.principal.id, query);
    const page = await this.repository.list({
      ownerId: context.principal.id,
      ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
      limit: query.limit,
      ...(cursor === undefined ? {} : { cursor }),
      order: query.order,
    });
    const visible: MemoryView[] = [];
    for (const record of page.records) {
      try {
        await this.authorize(context.principal, "READ", record, "memory.list");
        visible.push(this.toView(record));
      } catch (error) {
        if (!(error instanceof ApplicationException) || error.httpStatus !== 403) throw error;
      }
    }
    const nextCursor =
      page.hasMore && page.nextCursor !== null
        ? this.cursorCodec.reseal(page.nextCursor, context.principal.id, query)
        : null;
    return { data: visible, metadata: { nextCursor, hasMore: page.hasMore, limit: query.limit } };
  }

  async get(context: RequestExecutionContext, id: string): Promise<MemoryView> {
    const record = await this.repository.get(id, context.principal.id, true);
    if (record === null) throw notFound();
    await this.authorize(context.principal, "READ", record, "memory.read");
    return this.toView(record);
  }

  async create(
    context: RequestExecutionContext,
    dto: CreateMemoryDto,
    idempotencyKey: string,
  ): Promise<MemoryView> {
    const keyHash = sha256(idempotencyKey);
    const requestHash = sha256(
      canonicalize({
        method: "POST",
        route: "/api/v1/memories",
        principal: context.principal.id,
        body: dto,
      }),
    );
    const scope: IdempotencyScope = {
      environment: this.environment,
      principalId: context.principal.id,
      method: "POST",
      routeTemplate: "/api/v1/memories",
      keyHash,
    };
    return this.repository.transaction(async (tx) => {
      const replay = await tx.findIdempotency(scope);
      if (replay !== null) {
        if (replay.requestHash !== requestHash)
          throw new ConflictException(
            "IDEMPOTENCY_KEY_REUSED",
            "The idempotency key was used for another request.",
          );
        if (replay.state === "IN_PROGRESS" || replay.responseBody === null)
          throw new ConflictException(
            "IDEMPOTENCY_IN_PROGRESS",
            "The original request is still in progress.",
          );
        return JSON.parse(this.encryption.decrypt(replay.responseBody)) as MemoryView;
      }
      await tx.beginIdempotency({ ...scope, requestHash });
      const category = await tx.getCategory(dto.categoryId);
      if (category === null)
        throw new ApplicationException({
          code: "CATEGORY_NOT_FOUND",
          message: "The memory category is unavailable.",
          httpStatus: 422,
        });
      const policy = await this.permissions.authorize({
        principal: context.principal,
        action: "CREATE",
        resourceId: null,
        ownerId: context.principal.id,
        sensitivity: dto.sensitivity,
        policyRef: null,
        policyVersion: null,
        purpose: "memory.create",
      });
      const id = randomUUID(),
        versionId = randomUUID(),
        now = this.now();
      const verification = dto.userConfirmed ? "USER_CONFIRMED" : "UNVERIFIED";
      await tx.insertMemory({
        id,
        versionId,
        ownerId: context.principal.id,
        actorId: context.principal.id,
        categoryId: dto.categoryId,
        importance: dto.importance,
        sensitivity: dto.sensitivity,
        verificationStatus: verification,
        permissionPolicyRef: policy.policyRef,
        permissionPolicyVersion: policy.policyVersion,
        userConfirmedAt: dto.userConfirmed ? now : null,
        titleCiphertext: this.encryption.encrypt(dto.title),
        summaryCiphertext: this.encryption.encrypt(dto.summary),
        purposeCiphertext: this.encryption.encrypt(dto.purpose),
        originatedAt: dto.originatedAt === undefined ? null : new Date(dto.originatedAt),
        sourceType: dto.userConfirmed ? "USER_CONFIRMED" : "USER_EXPLICIT",
        encryptionKeyRef: this.encryption.keyReference,
        now,
      });
      await tx.appendEvent(
        this.event(
          "MemorySaved",
          id,
          1,
          context,
          {
            memoryId: id,
            categoryId: dto.categoryId,
            operation: "CREATED",
            sensitivity: dto.sensitivity,
            verificationStatus: verification,
            currentVersionId: versionId,
          },
          policy.permissionVersion,
        ),
      );
      const record = await tx.get(id, context.principal.id, true);
      if (record === null) throw new Error("CREATED_MEMORY_NOT_FOUND");
      const view = this.toView(record);
      await tx.completeIdempotency(scope, this.encryption.encrypt(JSON.stringify(view)), 201);
      return view;
    });
  }

  async update(
    context: RequestExecutionContext,
    id: string,
    dto: UpdateMemoryDto,
  ): Promise<MemoryView> {
    return this.repository.transaction(async (tx) => {
      const current = await tx.get(id, context.principal.id, true);
      if (current === null) throw notFound();
      await this.authorize(context.principal, "UPDATE", current, "memory.update");
      if (current.version !== dto.expectedVersion)
        throw new ConflictException("VERSION_CONFLICT", "The memory version is stale.");
      const categoryId = dto.categoryId ?? current.category.id;
      if (dto.categoryId !== undefined && (await tx.getCategory(categoryId)) === null)
        throw new ApplicationException({
          code: "CATEGORY_NOT_FOUND",
          message: "The memory category is unavailable.",
          httpStatus: 422,
        });
      const title = dto.title ?? this.encryption.decrypt(current.titleCiphertext);
      const summary = dto.summary ?? this.encryption.decrypt(current.summaryCiphertext);
      const purpose = dto.purpose ?? this.encryption.decrypt(current.purposeCiphertext);
      let verification = current.verificationStatus;
      let confirmedAt = current.userConfirmedAt;
      if (dto.correctionReason !== undefined) {
        verification = "CORRECTED";
        confirmedAt = null;
      } else if (dto.userConfirmed === true) {
        verification = "USER_CONFIRMED";
        confirmedAt = this.now();
      } else if (
        dto.userConfirmed === false &&
        verification !== "SOURCE_VERIFIED" &&
        verification !== "CORRECTED"
      ) {
        verification = "UNVERIFIED";
        confirmedAt = null;
      }
      const state = dto.state ?? current.state;
      const now = this.now();
      const nextVersion = current.version + 1;
      const versionId = randomUUID();
      const linkOperations = [];
      const linkEvents: DomainEvent[] = [];
      for (const operation of dto.linkOperations ?? []) {
        if (operation.operation === "CREATE") {
          if (operation.targetMemoryId === id)
            throw validation("VALIDATION_FAILED", "A memory cannot link to itself.");
          const target = await tx.get(operation.targetMemoryId, context.principal.id, true);
          if (target === null) throw notFound();
          await this.authorize(context.principal, "READ", target, "memory.link");
          const [sourceId, targetId] = canonicalLink(
            id,
            operation.targetMemoryId,
            operation.relationshipType,
          );
          const linkId = randomUUID();
          linkOperations.push({
            operation: "CREATE" as const,
            id: linkId,
            sourceId,
            targetId,
            relationshipType: operation.relationshipType,
          });
          linkEvents.push(
            this.event(
              "MemoryLinkCreated",
              id,
              nextVersion,
              context,
              {
                memoryLinkId: linkId,
                sourceMemoryId: sourceId,
                targetMemoryId: targetId,
                relationshipType: operation.relationshipType,
                operation: "CREATED",
              },
              current.permissionPolicyVersion,
            ),
          );
        } else {
          linkOperations.push({
            operation: "DELETE" as const,
            id: operation.id,
            expectedVersion: operation.expectedVersion,
          });
          const link = current.links.find((candidate) => candidate.id === operation.id);
          if (link === undefined) throw notFound();
          linkEvents.push(
            this.event(
              "MemoryLinkDeleted",
              id,
              nextVersion,
              context,
              {
                memoryLinkId: link.id,
                sourceMemoryId: link.sourceMemoryId,
                targetMemoryId: link.targetMemoryId,
                relationshipType: link.relationshipType,
                operation: "DELETED",
              },
              current.permissionPolicyVersion,
            ),
          );
        }
      }
      await tx.updateMemory({
        id,
        ownerId: context.principal.id,
        expectedVersion: dto.expectedVersion,
        actorId: context.principal.id,
        categoryId,
        importance: dto.importance ?? current.importance,
        sensitivity: dto.sensitivity ?? current.sensitivity,
        state,
        verificationStatus: verification,
        userConfirmedAt: confirmedAt,
        versionId,
        versionNumber: nextVersion,
        titleCiphertext: this.encryption.encrypt(title),
        summaryCiphertext: this.encryption.encrypt(summary),
        purposeCiphertext: this.encryption.encrypt(purpose),
        sourceType: current.sourceType,
        sourceRefCiphertext: current.sourceRefCiphertext,
        originatedAt: current.originatedAt,
        confidence: current.confidence,
        correctionReasonCiphertext:
          dto.correctionReason === undefined ? null : this.encryption.encrypt(dto.correctionReason),
        encryptionKeyRef: this.encryption.keyReference,
        linkOperations,
        now,
      });
      await tx.appendEvent(
        this.event(
          "MemorySaved",
          id,
          nextVersion,
          context,
          {
            memoryId: id,
            categoryId,
            operation: "UPDATED",
            sensitivity: dto.sensitivity ?? current.sensitivity,
            verificationStatus: verification,
            currentVersionId: versionId,
          },
          current.permissionPolicyVersion,
        ),
      );
      if (state !== current.state)
        await tx.appendEvent(
          this.event(
            state === "ARCHIVED" ? "MemoryArchived" : "MemoryRestored",
            id,
            nextVersion,
            context,
            { memoryId: id, state, changedAt: now.toISOString() },
            current.permissionPolicyVersion,
          ),
        );
      for (const event of linkEvents) await tx.appendEvent(event);
      const updated = await tx.get(id, context.principal.id, true);
      if (updated === null) throw new Error("UPDATED_MEMORY_NOT_FOUND");
      return this.toView(updated);
    });
  }

  async delete(context: RequestExecutionContext, id: string): Promise<void> {
    await this.repository.transaction(async (tx) => {
      const current = await tx.get(id, context.principal.id, true);
      if (current === null) {
        const owner = await tx.getDeletionOwner(id);
        if (owner === context.principal.id) return;
        throw notFound();
      }
      await this.authorize(context.principal, "DELETE", current, "memory.delete");
      const deletedAt = this.now();
      const purgeAfter = new Date(deletedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      const deletionVersion = 1;
      await tx.deleteMemory({
        id,
        ownerId: context.principal.id,
        expectedDeletionVersion: deletionVersion,
        deletedAt,
        purgeAfter,
      });
      await tx.appendEvent({
        ...this.event(
          "MemoryDeletionRequired",
          id,
          current.version + 1,
          context,
          {
            memoryId: id,
            deletionVersion,
            deletedAt: deletedAt.toISOString(),
            purgeAfter: purgeAfter.toISOString(),
          },
          current.permissionPolicyVersion,
        ),
        deletionVersion,
      });
    });
  }

  private async authorize(
    principal: Principal,
    action: "READ" | "UPDATE" | "DELETE",
    record: MemoryRecord,
    purpose: string,
  ): Promise<void> {
    await this.permissions.authorize({
      principal,
      action,
      resourceId: record.id,
      ownerId: record.ownerId,
      sensitivity: record.sensitivity,
      policyRef: record.permissionPolicyRef,
      policyVersion: record.permissionPolicyVersion,
      purpose,
    });
  }
  private toView(record: MemoryRecord): MemoryView {
    return {
      id: record.id,
      title: this.encryption.decrypt(record.titleCiphertext),
      summary: this.encryption.decrypt(record.summaryCiphertext),
      category: {
        id: record.category.id,
        key: record.category.key,
        displayName: record.category.displayName,
      },
      importance: record.importance,
      state: record.state,
      sensitivity: record.sensitivity,
      verificationStatus: record.verificationStatus,
      purpose: this.encryption.decrypt(record.purposeCiphertext),
      sourceType: record.sourceType,
      sourceRef:
        record.sourceRefCiphertext === null
          ? null
          : this.encryption.decrypt(record.sourceRefCiphertext),
      originatedAt: record.originatedAt?.toISOString() ?? null,
      confidence: record.confidence,
      userConfirmedAt: record.userConfirmedAt?.toISOString() ?? null,
      links: record.links.map((link) => ({ ...link, createdAt: link.createdAt.toISOString() })),
      visibility: "PRIVATE",
      retentionPolicyRef: "U0_ACTIVE",
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      version: record.version,
    };
  }
  private event(
    eventType: string,
    subjectId: string,
    subjectVersion: number,
    context: RequestExecutionContext,
    payload: object,
    permissionVersion: number,
  ): DomainEvent {
    return {
      eventId: randomUUID(),
      eventType,
      eventVersion: 1,
      occurredAt: this.now().toISOString(),
      producer: "memory-service",
      subjectType: "MEMORY",
      subjectId,
      subjectVersion,
      actorId: context.principal.id,
      ownerId: context.principal.id,
      correlationId: context.correlationId,
      permissionVersion,
      payload,
    } as DomainEvent;
  }
}

function canonicalLink(
  source: string,
  target: string,
  type: RelationshipType,
): readonly [string, string] {
  return SYMMETRIC_RELATIONSHIPS.has(type) && source > target ? [target, source] : [source, target];
}
function notFound(): ApplicationException {
  return new ApplicationException({
    code: "RESOURCE_NOT_FOUND",
    message: "The requested resource was not found.",
    httpStatus: 404,
  });
}
function validation(code: string, message: string): ApplicationException {
  return new ApplicationException({ code, message, httpStatus: 422 });
}
function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

class CursorCodec {
  constructor(private readonly secret: string) {}
  decode(
    token: string,
    principal: string,
    query: ListMemoriesQuery,
  ): { createdAt: Date; id: string } {
    try {
      const [payload, signature] = token.split(".");
      if (payload === undefined || signature === undefined) throw new Error();
      const expected = createHmac("sha256", this.secret).update(payload).digest();
      const actual = Buffer.from(signature, "base64url");
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
        throw new Error();
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
        principal: string;
        filters: string;
        expiresAt: number;
        createdAt: string;
        id: string;
      };
      if (parsed.principal !== principal || parsed.filters !== this.filters(query))
        throw new ApplicationException({
          code: "CURSOR_CONTEXT_MISMATCH",
          message: "The cursor does not match this request.",
          httpStatus: 400,
        });
      if (parsed.expiresAt < Date.now())
        throw new ApplicationException({
          code: "CURSOR_EXPIRED",
          message: "The cursor has expired.",
          httpStatus: 400,
        });
      return { createdAt: new Date(parsed.createdAt), id: parsed.id };
    } catch (error) {
      if (error instanceof ApplicationException) throw error;
      throw new ApplicationException({
        code: "INVALID_CURSOR",
        message: "The cursor is invalid.",
        httpStatus: 400,
      });
    }
  }
  reseal(raw: string, principal: string, query: ListMemoriesQuery): string {
    const position = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      createdAt: string;
      id: string;
    };
    const payload = Buffer.from(
      JSON.stringify({
        ...position,
        principal,
        filters: this.filters(query),
        expiresAt: Date.now() + 15 * 60 * 1000,
        contractVersion: 1,
        indexVersion: 1,
      }),
    ).toString("base64url");
    return `${payload}.${createHmac("sha256", this.secret).update(payload).digest("base64url")}`;
  }
  private filters(query: ListMemoriesQuery): string {
    return sha256(
      canonicalize({ categoryId: query.categoryId ?? null, sort: query.sort, order: query.order }),
    );
  }
}
