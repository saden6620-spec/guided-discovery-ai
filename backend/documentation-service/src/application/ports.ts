import type { DomainEvent } from "@guided-discovery/events";
import type { JournalRecord, Principal } from "../domain/journal.js";
export const JOURNAL_REPOSITORY = Symbol("JOURNAL_REPOSITORY"),
  ENCRYPTION_ADAPTER = Symbol("ENCRYPTION_ADAPTER"),
  PERMISSION_GATEWAY = Symbol("PERMISSION_GATEWAY"),
  PRINCIPAL_RESOLVER = Symbol("PRINCIPAL_RESOLVER");
export interface IdempotencyInput {
  environment: string;
  principalId: string;
  keyHash: string;
  requestHash: string;
}
export interface JournalRepository {
  list(input: {
    ownerId: string;
    limit: number;
    tripId?: string;
    startedFrom?: Date;
    startedTo?: Date;
    cursor?: { createdAt: Date; id: string };
  }): Promise<{ records: readonly JournalRecord[]; nextCursor: string | null; hasMore: boolean }>;
  get(id: string, ownerId: string): Promise<JournalRecord | null>;
  create(
    record: JournalRecord,
    event: DomainEvent,
    idem: IdempotencyInput,
    response: Buffer,
  ): Promise<JournalRecord | { state: string; requestHash: string; responseBody: Buffer | null }>;
  update(
    record: JournalRecord,
    expectedVersion: number,
    event: DomainEvent,
  ): Promise<JournalRecord>;
  delete(
    id: string,
    ownerId: string,
    event: DomainEvent,
    deletedAt: Date,
    purgeAfter: Date,
  ): Promise<"DELETED" | "NOT_FOUND">;
  ping(signal?: AbortSignal): Promise<void>;
  schemaIsCurrent(signal?: AbortSignal): Promise<boolean>;
}
export interface EncryptionAdapter {
  encrypt(value: string): Buffer;
  decrypt(value: Buffer): string;
}
export interface PermissionGateway {
  authorize(input: {
    principal: Principal;
    action: string;
    resourceId: string | null;
    ownerId: string;
    purpose: string;
    permissionPolicyRef?: string;
    requestedPermissionVersion?: number;
  }): Promise<{ policyRef: string; permissionVersion: number }>;
}
export interface PrincipalResolver {
  resolveUser(value?: string): Promise<Principal>;
}
