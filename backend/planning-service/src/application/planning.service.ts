import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  ApplicationException,
  ConflictException,
  ValidationException,
} from "@guided-discovery/errors";
import type { DomainEvent } from "@guided-discovery/events";

import type {
  ChecklistItem,
  PlanItem,
  PlanRecord,
  Principal,
  Reservation,
} from "../domain/plan.js";
import type { CreatePlanDto, ListPlansQuery, UpdatePlanDto } from "../presentation/schemas.js";
import {
  ENCRYPTION_ADAPTER,
  PERMISSION_GATEWAY,
  PLAN_REPOSITORY,
  type EncryptionAdapter,
  type PlanRepository,
  type PermissionGateway,
} from "./ports.js";

export interface RequestExecutionContext {
  principal: Principal;
  requestId: string;
  correlationId: string;
}

@Injectable()
export class PlanningApplicationService {
  private readonly cursor = new CursorCodec(
    process.env.CURSOR_SIGNING_KEY ?? "planning-development-cursor-signing-key-change-me",
  );
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly repository: PlanRepository,
    @Inject(ENCRYPTION_ADAPTER) private readonly encryption: EncryptionAdapter,
    @Inject(PERMISSION_GATEWAY) private readonly permissions: PermissionGateway,
  ) {}

  async list(context: RequestExecutionContext, query: ListPlansQuery) {
    await this.permissions.authorize({
      principal: context.principal,
      action: "READ",
      resourceId: null,
      ownerId: context.principal.id,
      purpose: "plan.list",
    });
    const result = await this.repository.list({
      ownerId: context.principal.id,
      limit: query.limit,
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.startDateFrom === undefined ? {} : { startDateFrom: query.startDateFrom }),
      ...(query.startDateTo === undefined ? {} : { startDateTo: query.startDateTo }),
      ...(query.cursor === undefined
        ? {}
        : { cursor: this.cursor.decode(query.cursor, context.principal.id, query) }),
    });
    return {
      data: result.records.map((record) => this.view(record)),
      metadata: {
        pagination: {
          nextCursor:
            result.nextCursor === null
              ? null
              : this.cursor.reseal(result.nextCursor, context.principal.id, query),
          hasMore: result.hasMore,
          limit: query.limit,
        },
      },
    };
  }

  async create(context: RequestExecutionContext, input: CreatePlanDto, idempotencyKey: string) {
    await this.permissions.authorize({
      principal: context.principal,
      action: "CREATE",
      resourceId: null,
      ownerId: context.principal.id,
      purpose: "plan.create",
    });
    const now = new Date();
    const id = randomUUID();
    const plan: PlanRecord = {
      id,
      ownerId: context.principal.id,
      title: input.title,
      status: "DRAFT",
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      budgetAmount: input.budgetAmount ?? null,
      budgetCurrency: input.budgetCurrency ?? null,
      notes: input.notes ?? null,
      items: compact(
        (input.items ?? []).map((item) => ({
          id: randomUUID(),
          ...item,
          startsAt: date(item.startsAt),
          endsAt: date(item.endsAt),
          locationReference: item.locationReference ?? null,
          notes: item.notes ?? null,
          version: 1,
        })),
      ),
      reservations: (input.reservations ?? []).map((reservation) => ({
        id: randomUUID(),
        ...reservation,
        startsAt: date(reservation.startsAt),
        endsAt: date(reservation.endsAt),
        reference: reservation.reference ?? null,
        version: 1,
      })),
      checklistItems: compact(
        (input.checklistItems ?? []).map((item) => ({
          id: randomUUID(),
          ...item,
          version: 1,
        })),
      ),
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    validateTemporal(plan.items, plan.reservations);
    validatePositions(plan.items, plan.checklistItems);
    const keyHash = sha256(idempotencyKey);
    const requestHash = sha256(JSON.stringify(input));
    const result = await this.repository.create(
      plan,
      this.event("PlanChanged", plan, context, "CREATED"),
      {
        environment: process.env.APP_ENV ?? "development",
        principalId: context.principal.id,
        keyHash,
        requestHash,
      },
      this.encryption.encrypt(JSON.stringify(this.view(plan))),
    );
    if (!("records" in result) && "state" in result) {
      if (result.requestHash !== requestHash)
        throw new ConflictException(
          "IDEMPOTENCY_KEY_REUSED",
          "The idempotency key was used with another request.",
        );
      if (result.state === "IN_PROGRESS" || result.responseBody === null)
        throw new ConflictException(
          "IDEMPOTENCY_IN_PROGRESS",
          "The original request is still in progress.",
        );
      return JSON.parse(this.encryption.decrypt(result.responseBody)) as ReturnType<
        PlanningApplicationService["view"]
      >;
    }
    return this.view(result as PlanRecord);
  }

  async update(context: RequestExecutionContext, id: string, input: UpdatePlanDto) {
    const current = await this.repository.get(id, context.principal.id);
    if (current === null) throw notFound();
    await this.permissions.authorize({
      principal: context.principal,
      action: "UPDATE",
      resourceId: id,
      ownerId: current.ownerId,
      purpose: "plan.update",
    });
    if (current.version !== input.expectedVersion)
      throw new ConflictException("VERSION_CONFLICT", "The plan version has changed.");
    const status = input.status ?? current.status;
    validateTransition(current.status, status);
    const items = compact(
      applyOperations(
        current.items,
        input.itemOperations ?? [],
        (value) => ({
          id: randomUUID(),
          ...value,
          startsAt: date(value.startsAt),
          endsAt: date(value.endsAt),
          locationReference: value.locationReference ?? null,
          notes: value.notes ?? null,
          version: 1,
        }),
        (existing, value) => ({
          ...existing,
          ...value,
          startsAt: date(value.startsAt),
          endsAt: date(value.endsAt),
          locationReference: value.locationReference ?? null,
          notes: value.notes ?? null,
          version: existing.version + 1,
        }),
      ),
    );
    const reservations = applyOperations(
      current.reservations,
      input.reservationOperations ?? [],
      (value) => ({
        id: randomUUID(),
        ...value,
        startsAt: date(value.startsAt),
        endsAt: date(value.endsAt),
        reference: value.reference ?? null,
        version: 1,
      }),
      (existing, value) => ({
        ...existing,
        ...value,
        startsAt: date(value.startsAt),
        endsAt: date(value.endsAt),
        reference: value.reference ?? null,
        version: existing.version + 1,
      }),
    );
    const checklistItems = compact(
      applyOperations(
        current.checklistItems,
        input.checklistOperations ?? [],
        (value) => ({ id: randomUUID(), ...value, version: 1 }),
        (existing, value) => ({ ...existing, ...value, version: existing.version + 1 }),
      ),
    );
    validateTemporal(items, reservations);
    validatePositions(items, checklistItems);
    const updated: PlanRecord = {
      ...current,
      title: input.title ?? current.title,
      status,
      startDate: input.startDate ?? current.startDate,
      endDate: input.endDate ?? current.endDate,
      budgetAmount: input.budgetAmount ?? current.budgetAmount,
      budgetCurrency: input.budgetCurrency ?? current.budgetCurrency,
      notes: input.notes ?? current.notes,
      items,
      reservations,
      checklistItems,
      updatedAt: new Date(),
      version: current.version + 1,
    };
    if (
      updated.startDate !== null &&
      updated.endDate !== null &&
      updated.endDate < updated.startDate
    )
      throw validation("/endDate", "DATE_RANGE_INVALID", "End date cannot precede start date.");
    return this.view(
      await this.repository.update(
        updated,
        input.expectedVersion,
        this.event("PlanChanged", updated, context, "UPDATED"),
      ),
    );
  }

  async delete(context: RequestExecutionContext, id: string): Promise<void> {
    const current = await this.repository.get(id, context.principal.id);
    if (current === null) throw notFound();
    await this.permissions.authorize({
      principal: context.principal,
      action: "DELETE",
      resourceId: id,
      ownerId: current.ownerId,
      purpose: "plan.delete",
    });
    const now = new Date();
    const purgeAfter = new Date(now.getTime() + 7 * 86_400_000);
    const result = await this.repository.delete(
      id,
      context.principal.id,
      this.event("PlanChanged", { ...current, version: current.version + 1 }, context, "DELETED"),
      now,
      purgeAfter,
    );
    if (result === "NOT_FOUND") throw notFound();
  }

  private view(plan: PlanRecord) {
    return {
      id: plan.id,
      title: plan.title,
      status: plan.status,
      startDate: plan.startDate,
      endDate: plan.endDate,
      budget:
        plan.budgetAmount === null
          ? null
          : { amount: plan.budgetAmount, currency: plan.budgetCurrency as string },
      notes: plan.notes,
      items: plan.items.map((item) => ({
        ...item,
        startsAt: item.startsAt?.toISOString() ?? null,
        endsAt: item.endsAt?.toISOString() ?? null,
      })),
      reservations: plan.reservations.map((item) => ({
        ...item,
        startsAt: item.startsAt?.toISOString() ?? null,
        endsAt: item.endsAt?.toISOString() ?? null,
      })),
      checklistItems: plan.checklistItems,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      version: plan.version,
    };
  }
  private event(
    eventType: string,
    plan: Pick<PlanRecord, "id" | "ownerId" | "version" | "status">,
    context: RequestExecutionContext,
    operation: string,
  ): DomainEvent {
    return {
      eventId: randomUUID(),
      eventType,
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      producer: "planning-service",
      subjectType: "PLAN",
      subjectId: plan.id,
      subjectVersion: plan.version,
      actorId: context.principal.id,
      ownerId: plan.ownerId,
      correlationId: context.correlationId,
      payload: { planId: plan.id, operation, status: plan.status },
    } as DomainEvent;
  }
}

function date(value: string | undefined): Date | null {
  return value === undefined ? null : new Date(value);
}
function validateTemporal(
  items: readonly Pick<PlanItem, "startsAt" | "endsAt">[],
  reservations: readonly Pick<Reservation, "startsAt" | "endsAt">[],
): void {
  for (const value of [...items, ...reservations])
    if (value.startsAt !== null && value.endsAt !== null && value.endsAt <= value.startsAt)
      throw validation("/endsAt", "DATE_RANGE_INVALID", "End time must be after start time.");
}
function validatePositions(
  items: readonly Pick<PlanItem, "position">[],
  checklist: readonly Pick<ChecklistItem, "position">[],
): void {
  for (const [path, values] of [
    ["/items", items],
    ["/checklistItems", checklist],
  ] as const)
    if (new Set(values.map((value) => value.position)).size !== values.length)
      throw validation(path, "POSITION_COLLISION", "Positions must be unique.");
}
function compact<T extends { readonly position: number }>(values: readonly T[]): readonly T[] {
  return [...values]
    .sort((left, right) => left.position - right.position)
    .map((value, position) => ({ ...value, position }));
}
function validateTransition(from: string, to: string): void {
  if (from === to) return;
  const allowed =
    from === "DRAFT"
      ? ["ACCEPTED", "CANCELLED"]
      : from === "ACCEPTED"
        ? ["COMPLETED", "CANCELLED"]
        : [];
  if (!allowed.includes(to))
    throw new ConflictException(
      "INVALID_STATE_TRANSITION",
      "The requested plan state transition is invalid.",
      { currentState: from, requestedAction: to },
    );
}
function applyOperations<T extends { id: string; version: number }, V>(
  current: readonly T[],
  operations: readonly (
    | { operation: "CREATE"; clientReference: string; value: V }
    | { operation: "UPDATE"; id: string; expectedVersion: number; value: V }
    | { operation: "DELETE"; id: string; expectedVersion: number }
  )[],
  create: (value: V) => T,
  update: (existing: T, value: V) => T,
): readonly T[] {
  const result = [...current];
  const seen = new Set<string>();
  const references = new Set<string>();
  for (const operation of operations) {
    if (operation.operation === "CREATE") {
      if (references.has(operation.clientReference))
        throw validation(
          "/operations",
          "DUPLICATE_CLIENT_REFERENCE",
          "Client references must be unique.",
        );
      references.add(operation.clientReference);
      result.push(create(operation.value));
      continue;
    }
    if (seen.has(operation.id))
      throw validation("/operations", "DUPLICATE_CHILD_OPERATION", "A child may be mutated once.");
    seen.add(operation.id);
    const index = result.findIndex((value) => value.id === operation.id);
    if (index < 0) throw notFound();
    const existing = result[index] as T;
    if (existing.version !== operation.expectedVersion)
      throw new ConflictException("VERSION_CONFLICT", "A child version has changed.");
    if (operation.operation === "DELETE") result.splice(index, 1);
    else result[index] = update(existing, operation.value);
  }
  return result;
}
function notFound(): ApplicationException {
  return new ApplicationException({
    code: "RESOURCE_NOT_FOUND",
    message: "Plan not found.",
    httpStatus: 404,
  });
}
function validation(field: string, code: string, message: string): ValidationException {
  return new ValidationException([{ field, code, message }]);
}
function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
class CursorCodec {
  constructor(private readonly secret: string) {}
  decode(token: string, principal: string, query: ListPlansQuery): { createdAt: Date; id: string } {
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
  reseal(raw: string, principal: string, query: ListPlansQuery): string {
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
  private filters(query: ListPlansQuery): string {
    return sha256(
      JSON.stringify({
        status: query.status ?? null,
        startDateFrom: query.startDateFrom ?? null,
        startDateTo: query.startDateTo ?? null,
      }),
    );
  }
}
