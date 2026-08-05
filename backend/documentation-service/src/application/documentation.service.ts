import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  ApplicationException,
  ConflictException,
  ValidationException,
} from "@guided-discovery/errors";
import type { DomainEvent } from "@guided-discovery/events";
import type {
  JournalEntry,
  JournalRecord,
  MediaKind,
  Reflection,
  MediaReference,
  Principal,
} from "../domain/journal.js";
import type {
  CreateJournalDto,
  ListJournalsQuery,
  UpdateJournalDto,
} from "../presentation/schemas.js";
import {
  ENCRYPTION_ADAPTER,
  JOURNAL_REPOSITORY,
  PERMISSION_GATEWAY,
  type EncryptionAdapter,
  type JournalRepository,
  type PermissionGateway,
} from "./ports.js";
export interface RequestExecutionContext {
  principal: Principal;
  requestId: string;
  correlationId: string;
}
@Injectable()
export class DocumentationApplicationService {
  constructor(
    @Inject(JOURNAL_REPOSITORY) private readonly repository: JournalRepository,
    @Inject(ENCRYPTION_ADAPTER) private readonly encryption: EncryptionAdapter,
    @Inject(PERMISSION_GATEWAY) private readonly permissions: PermissionGateway,
  ) {}
  async list(context: RequestExecutionContext, query: ListJournalsQuery) {
    await this.permissions.authorize({
      principal: context.principal,
      action: "READ",
      resourceId: null,
      ownerId: context.principal.id,
      purpose: "journal.list",
    });
    const cursor = new CursorCodec(
      process.env.CURSOR_SIGNING_KEY ?? "documentation-development-cursor-signing-key-change-me",
    );
    const result = await this.repository.list({
      ownerId: context.principal.id,
      limit: query.limit,
      ...(query.tripId ? { tripId: query.tripId } : {}),
      ...(query.startedFrom ? { startedFrom: new Date(query.startedFrom) } : {}),
      ...(query.startedTo ? { startedTo: new Date(query.startedTo) } : {}),
      ...(query.cursor ? { cursor: cursor.decode(query.cursor, context.principal.id, query) } : {}),
    });
    for (const journal of result.records)
      await this.permissions.authorize({
        principal: context.principal,
        action: "READ",
        resourceId: journal.id,
        ownerId: journal.ownerId,
        purpose: "journal.read",
        permissionPolicyRef: journal.permissionPolicyRef,
        requestedPermissionVersion: journal.permissionPolicyVersion,
      });
    return {
      data: result.records.map((v) => this.view(v)),
      metadata: {
        pagination: {
          nextCursor: result.nextCursor
            ? cursor.reseal(result.nextCursor, context.principal.id, query)
            : null,
          hasMore: result.hasMore,
          limit: query.limit,
        },
      },
    };
  }
  async create(context: RequestExecutionContext, input: CreateJournalDto, key: string) {
    const permission = await this.permissions.authorize({
      principal: context.principal,
      action: "CREATE",
      resourceId: null,
      ownerId: context.principal.id,
      purpose: "journal.create",
    });
    const now = new Date(),
      journal: JournalRecord = {
        id: randomUUID(),
        ownerId: context.principal.id,
        title: input.title,
        description: input.description ?? null,
        tripId: input.tripId ?? null,
        permissionPolicyRef: permission.policyRef,
        permissionPolicyVersion: permission.permissionVersion,
        startedAt: date(input.startedAt),
        endedAt: date(input.endedAt),
        entries: compact(
          (input.entries ?? []).map((v) => ({
            id: randomUUID(),
            type: "TEXT",
            content: v.content,
            mediaReferenceId: null,
            occurredAt: new Date(v.occurredAt),
            locationReference: v.locationReference ?? null,
            position: v.position,
            version: 1,
          })),
        ),
        reflections: [],
        media: [],
        createdAt: now,
        updatedAt: now,
        version: 1,
      };
    validateJournal(journal);
    const requestHash = sha(JSON.stringify(input));
    const result = await this.repository.create(
      journal,
      this.event(journal, context, "CREATED"),
      {
        environment: process.env.APP_ENV ?? "development",
        principalId: context.principal.id,
        keyHash: sha(key),
        requestHash,
      },
      this.encryption.encrypt(JSON.stringify(this.view(journal))),
    );
    if (!("id" in result)) {
      if (result.requestHash !== requestHash)
        throw new ConflictException("IDEMPOTENCY_KEY_REUSED", "The idempotency key was reused.");
      if (result.state !== "COMPLETED" || !result.responseBody)
        throw new ConflictException("IDEMPOTENCY_IN_PROGRESS", "The request is in progress.");
      return JSON.parse(this.encryption.decrypt(result.responseBody));
    }
    return this.view(result);
  }
  async update(context: RequestExecutionContext, id: string, input: UpdateJournalDto) {
    const current = await this.repository.get(id, context.principal.id);
    if (!current) throw notFound();
    await this.permissions.authorize({
      principal: context.principal,
      action: "UPDATE",
      resourceId: id,
      ownerId: current.ownerId,
      purpose: "journal.update",
      permissionPolicyRef: current.permissionPolicyRef,
      requestedPermissionVersion: current.permissionPolicyVersion,
    });
    if (current.version !== input.expectedVersion)
      throw new ConflictException("VERSION_CONFLICT", "The journal version has changed.");
    const refs = new Map<string, string>();
    const media = apply<MediaReference, MediaInput>(
      current.media,
      input.mediaOperations ?? [],
      (v) => {
        const id = randomUUID();
        return { id, ...v, caption: v.caption ?? null, version: 1 };
      },
      (a, v) => ({ ...a, ...v, caption: v.caption ?? null, version: a.version + 1 }),
      refs,
    );
    const entries = apply<JournalEntry, EntryInput>(
      current.entries,
      input.entryOperations ?? [],
      (v) => entry(v, refs),
      (a, v) => ({ ...a, ...entry(v, refs), id: a.id, version: a.version + 1 }),
      refs,
    );
    const reflections = apply<Reflection, ReflectionInput>(
      current.reflections,
      input.reflectionOperations ?? [],
      (v) => ({
        id: randomUUID(),
        entryId: v.entryId ?? null,
        text: v.text,
        occurredAt: new Date(v.occurredAt),
        position: v.position,
        version: 1,
      }),
      (a, v) => ({
        ...a,
        entryId: v.entryId ?? null,
        text: v.text,
        occurredAt: new Date(v.occurredAt),
        position: v.position,
        version: a.version + 1,
      }),
      refs,
    );
    const updated: JournalRecord = {
      ...current,
      title: input.title ?? current.title,
      description: input.description ?? current.description,
      tripId: input.tripId ?? current.tripId,
      startedAt: input.startedAt ? new Date(input.startedAt) : current.startedAt,
      endedAt: input.endedAt ? new Date(input.endedAt) : current.endedAt,
      media: compact(media),
      entries: compact(entries),
      reflections: compact(reflections),
      updatedAt: new Date(),
      version: current.version + 1,
    };
    validateJournal(updated);
    return this.view(
      await this.repository.update(
        updated,
        input.expectedVersion,
        this.event(updated, context, "UPDATED"),
      ),
    );
  }
  async delete(context: RequestExecutionContext, id: string) {
    const current = await this.repository.get(id, context.principal.id);
    if (!current) throw notFound();
    await this.permissions.authorize({
      principal: context.principal,
      action: "DELETE",
      resourceId: id,
      ownerId: current.ownerId,
      purpose: "journal.delete",
      permissionPolicyRef: current.permissionPolicyRef,
      requestedPermissionVersion: current.permissionPolicyVersion,
    });
    const now = new Date();
    if (
      (await this.repository.delete(
        id,
        current.ownerId,
        this.event({ ...current, version: current.version + 1 }, context, "DELETED"),
        now,
        new Date(now.getTime() + 7 * 86400000),
      )) === "NOT_FOUND"
    )
      throw notFound();
  }
  private view(j: JournalRecord) {
    return {
      id: j.id,
      title: j.title,
      description: j.description,
      tripId: j.tripId,
      visibility: "PRIVATE",
      startedAt: j.startedAt?.toISOString() ?? null,
      endedAt: j.endedAt?.toISOString() ?? null,
      entries: j.entries.map((v) => ({ ...v, occurredAt: v.occurredAt.toISOString() })),
      reflections: j.reflections.map((v) => ({ ...v, occurredAt: v.occurredAt.toISOString() })),
      media: j.media,
      createdAt: j.createdAt.toISOString(),
      updatedAt: j.updatedAt.toISOString(),
      version: j.version,
    };
  }
  private event(j: JournalRecord, c: RequestExecutionContext, operation: string): DomainEvent {
    return {
      eventId: randomUUID(),
      eventType: "JournalChanged",
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      producer: "documentation-service",
      subjectType: "JOURNAL",
      subjectId: j.id,
      subjectVersion: j.version,
      actorId: c.principal.id,
      ownerId: j.ownerId,
      correlationId: c.correlationId,
      payload: {
        journalId: j.id,
        operation,
        tripId: j.tripId,
        changedAt: new Date().toISOString(),
      },
    } as DomainEvent;
  }
}
type MediaInput = {
  mediaId: string;
  mediaKind: MediaKind;
  caption?: string | undefined;
  position: number;
};
type ReflectionInput = {
  entryId?: string | undefined;
  text: string;
  occurredAt: string;
  position: number;
};
type EntryInput = {
  type: JournalEntry["type"];
  content?: string | undefined;
  mediaReferenceId?: string | undefined;
  mediaReferenceClientReference?: string | undefined;
  occurredAt: string;
  locationReference?: string | undefined;
  position: number;
};
type Operation<V> =
  | { operation: "CREATE"; clientReference: string; value: V }
  | { operation: "UPDATE"; id: string; expectedVersion: number; value: V }
  | { operation: "DELETE"; id: string; expectedVersion: number };
function entry(v: EntryInput, refs: Map<string, string>): JournalEntry {
  const mediaReferenceId =
    v.mediaReferenceId ??
    (v.mediaReferenceClientReference ? refs.get(v.mediaReferenceClientReference) : undefined) ??
    null;
  if (v.type !== "TEXT" && !mediaReferenceId)
    throw validation("/entryOperations", "UNRESOLVED_DEPENDENCY", "Media reference is unresolved.");
  return {
    id: randomUUID(),
    type: v.type,
    content: v.content ?? null,
    mediaReferenceId,
    occurredAt: new Date(v.occurredAt),
    locationReference: v.locationReference ?? null,
    position: v.position,
    version: 1,
  };
}
function apply<T extends { id: string; version: number }, V>(
  current: readonly T[],
  ops: readonly Operation<V>[],
  create: (v: V) => T,
  update: (a: T, v: V) => T,
  refs: Map<string, string>,
): readonly T[] {
  const out = [...current],
    seen = new Set<string>();
  for (const op of ops) {
    if (op.operation === "CREATE") {
      if (refs.has(op.clientReference))
        throw validation(
          "/operations",
          "DUPLICATE_CLIENT_REFERENCE",
          "Client reference is duplicated.",
        );
      const made = create(op.value);
      refs.set(op.clientReference, made.id);
      out.push(made);
      continue;
    }
    if (seen.has(op.id))
      throw validation("/operations", "DUPLICATE_CHILD_OPERATION", "Child is duplicated.");
    seen.add(op.id);
    const i = out.findIndex((v) => v.id === op.id);
    if (i < 0) throw notFound();
    const existing = out[i]!;
    if (existing.version !== op.expectedVersion)
      throw new ConflictException("VERSION_CONFLICT", "A child version has changed.");
    if (op.operation === "DELETE") out.splice(i, 1);
    else out[i] = update(existing, op.value);
  }
  return out;
}
function validateJournal(j: JournalRecord) {
  if (j.startedAt && j.endedAt && j.endedAt < j.startedAt)
    throw validation("/endedAt", "DATE_RANGE_INVALID", "End precedes start.");
  for (const [path, values] of [
    ["/entries", j.entries],
    ["/reflections", j.reflections],
    ["/media", j.media],
  ] as const)
    if (new Set(values.map((v) => v.position)).size !== values.length)
      throw validation(path, "POSITION_COLLISION", "Positions must be unique.");
  const media = new Map(j.media.map((v) => [v.id, v]));
  for (const e of j.entries) {
    if (e.type === "TEXT" && (!e.content || e.mediaReferenceId))
      throw validation("/entries", "CONTENT_MEDIA_EXCLUSIVE", "Text entry is invalid.");
    if (e.type !== "TEXT") {
      const ref = e.mediaReferenceId ? media.get(e.mediaReferenceId) : undefined,
        expected = e.type.replace("_REFERENCE", "") as MediaKind;
      if (!ref)
        throw validation("/entries", "MEDIA_REFERENCE_INVALID", "Media reference is unavailable.");
      if (ref.mediaKind !== expected)
        throw validation(
          "/entries",
          "MEDIA_KIND_MISMATCH",
          "Media kind does not match entry type.",
        );
    }
  }
  for (const r of j.reflections)
    if (r.entryId && !j.entries.some((e) => e.id === r.entryId))
      throw validation(
        "/reflections",
        "ENTRY_REFERENCE_INVALID",
        "Entry reference is unavailable.",
      );
}
function compact<T extends { position: number }>(v: readonly T[]): readonly T[] {
  return [...v].sort((a, b) => a.position - b.position).map((x, position) => ({ ...x, position }));
}
function date(v?: string) {
  return v ? new Date(v) : null;
}
function sha(v: string) {
  return createHash("sha256").update(v).digest("hex");
}
class CursorCodec {
  constructor(private readonly secret: string) {}
  decode(
    token: string,
    principal: string,
    query: ListJournalsQuery,
  ): { createdAt: Date; id: string } {
    try {
      const [payload, signature] = token.split(".");
      if (!payload || !signature) throw new Error();
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
      const createdAt = new Date(parsed.createdAt);
      if (Number.isNaN(createdAt.getTime()) || !parsed.id) throw new Error();
      return { createdAt, id: parsed.id };
    } catch (error) {
      if (error instanceof ApplicationException) throw error;
      throw new ApplicationException({
        code: "INVALID_CURSOR",
        message: "The cursor is invalid.",
        httpStatus: 400,
      });
    }
  }
  reseal(raw: string, principal: string, query: ListJournalsQuery): string {
    const position = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      createdAt: string;
      id: string;
    };
    const payload = Buffer.from(
      JSON.stringify({
        ...position,
        principal,
        filters: this.filters(query),
        expiresAt: Date.now() + 900_000,
      }),
    ).toString("base64url");
    return `${payload}.${createHmac("sha256", this.secret).update(payload).digest("base64url")}`;
  }
  private filters(query: ListJournalsQuery): string {
    return sha(
      JSON.stringify({
        tripId: query.tripId ?? null,
        startedFrom: query.startedFrom ?? null,
        startedTo: query.startedTo ?? null,
      }),
    );
  }
}
function notFound() {
  return new ApplicationException({
    code: "RESOURCE_NOT_FOUND",
    message: "Journal not found.",
    httpStatus: 404,
  });
}
function validation(field: string, code: string, message: string) {
  return new ValidationException([{ field, code, message }]);
}
