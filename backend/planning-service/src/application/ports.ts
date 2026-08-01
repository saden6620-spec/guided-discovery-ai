import type { DomainEvent } from "@guided-discovery/events";

import type { PlanRecord, Principal } from "../domain/plan.js";

export const PLAN_REPOSITORY = Symbol("PLAN_REPOSITORY");
export const ENCRYPTION_ADAPTER = Symbol("ENCRYPTION_ADAPTER");
export const PERMISSION_GATEWAY = Symbol("PERMISSION_GATEWAY");
export const PRINCIPAL_RESOLVER = Symbol("PRINCIPAL_RESOLVER");

export interface EncryptionAdapter {
  encrypt(value: string): Buffer;
  decrypt(value: Buffer): string;
}
export interface PrincipalResolver {
  resolve(authorization: string | undefined): Promise<Principal>;
}
export interface PermissionGateway {
  authorize(input: {
    principal: Principal;
    action: "READ" | "CREATE" | "UPDATE" | "DELETE";
    resourceId: string | null;
    ownerId: string | null;
    purpose: string;
  }): Promise<void>;
}
export interface PlanPageResult {
  records: readonly PlanRecord[];
  hasMore: boolean;
  nextCursor: string | null;
}
export interface IdempotencyScope {
  environment: string;
  principalId: string;
  keyHash: string;
  requestHash: string;
}
export interface IdempotencyReplay {
  requestHash: string;
  state: "IN_PROGRESS" | "COMPLETED";
  responseStatus: number | null;
  responseBody: Buffer | null;
}

export interface PlanRepository {
  list(input: {
    ownerId: string;
    limit: number;
    status?: string;
    startDateFrom?: string;
    startDateTo?: string;
    cursor?: { createdAt: Date; id: string };
  }): Promise<PlanPageResult>;
  get(id: string, ownerId: string): Promise<PlanRecord | null>;
  create(
    plan: PlanRecord,
    event: DomainEvent,
    idempotency: IdempotencyScope,
    encryptedResponse: Buffer,
  ): Promise<PlanRecord | IdempotencyReplay>;
  update(plan: PlanRecord, expectedVersion: number, event: DomainEvent): Promise<PlanRecord>;
  delete(
    id: string,
    ownerId: string,
    event: DomainEvent,
    now: Date,
    purgeAfter: Date,
  ): Promise<"DELETED" | "NOT_FOUND">;
  ping(signal: AbortSignal): Promise<void>;
  schemaIsCurrent(signal: AbortSignal): Promise<boolean>;
  close(): Promise<void>;
}
