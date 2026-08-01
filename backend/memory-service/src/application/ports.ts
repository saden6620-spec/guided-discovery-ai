import type { PoolClient } from "pg";

import type { DomainEvent } from "@guided-discovery/events";

import type { MemoryCategory, MemoryRecord, Principal } from "../domain/memory.js";

export const MEMORY_REPOSITORY = Symbol("MEMORY_REPOSITORY");
export const ENCRYPTION_ADAPTER = Symbol("ENCRYPTION_ADAPTER");
export const PERMISSION_GATEWAY = Symbol("PERMISSION_GATEWAY");
export const PRINCIPAL_RESOLVER = Symbol("PRINCIPAL_RESOLVER");

export interface EncryptionAdapter {
  readonly keyReference: string;
  encrypt(plaintext: string): Buffer;
  decrypt(ciphertext: Buffer): string;
}

export interface PermissionGateway {
  authorize(input: {
    readonly principal: Principal;
    readonly action: "READ" | "CREATE" | "UPDATE" | "DELETE";
    readonly resourceId: string | null;
    readonly ownerId: string | null;
    readonly sensitivity: string;
    readonly policyRef: string | null;
    readonly policyVersion: number | null;
    readonly purpose: string;
  }): Promise<{
    readonly policyRef: string;
    readonly policyVersion: number;
    readonly permissionVersion: number;
  }>;
}

export interface PrincipalResolver {
  resolve(authorization: string | undefined): Promise<Principal>;
}

export interface MemoryPageResult {
  readonly records: readonly MemoryRecord[];
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

export interface MemoryTransaction {
  readonly client: PoolClient;
  getCategory(id: string): Promise<MemoryCategory | null>;
  get(id: string, ownerId: string, includeArchived?: boolean): Promise<MemoryRecord | null>;
  getDeletionOwner(id: string): Promise<string | null>;
  insertMemory(input: CreatePersistenceInput): Promise<void>;
  updateMemory(input: UpdatePersistenceInput): Promise<void>;
  deleteMemory(input: DeletePersistenceInput): Promise<void>;
  appendEvent(event: DomainEvent): Promise<void>;
  findIdempotency(input: IdempotencyScope): Promise<IdempotencyReplay | null>;
  beginIdempotency(input: IdempotencyScope & { readonly requestHash: string }): Promise<void>;
  completeIdempotency(
    scope: IdempotencyScope,
    encryptedResponse: Buffer,
    status: number,
  ): Promise<void>;
}

export interface MemoryRepository {
  transaction<T>(work: (transaction: MemoryTransaction) => Promise<T>): Promise<T>;
  list(input: {
    readonly ownerId: string;
    readonly categoryId?: string;
    readonly limit: number;
    readonly cursor?: { readonly createdAt: Date; readonly id: string };
    readonly order: "asc" | "desc";
  }): Promise<MemoryPageResult>;
  get(id: string, ownerId: string, includeArchived?: boolean): Promise<MemoryRecord | null>;
  listCategories(): Promise<readonly MemoryCategory[]>;
  ping(signal: AbortSignal): Promise<void>;
  schemaIsCurrent(signal: AbortSignal): Promise<boolean>;
  acknowledgeDeletion(event: DomainEvent): Promise<boolean>;
  purgeDue(requiredConsumers: readonly string[], limit: number): Promise<number>;
  close(): Promise<void>;
}

export interface CreatePersistenceInput {
  readonly id: string;
  readonly versionId: string;
  readonly ownerId: string;
  readonly actorId: string;
  readonly categoryId: string;
  readonly importance: number;
  readonly sensitivity: string;
  readonly verificationStatus: string;
  readonly permissionPolicyRef: string;
  readonly permissionPolicyVersion: number;
  readonly userConfirmedAt: Date | null;
  readonly titleCiphertext: Buffer;
  readonly summaryCiphertext: Buffer;
  readonly purposeCiphertext: Buffer;
  readonly originatedAt: Date | null;
  readonly sourceType: "USER_EXPLICIT" | "USER_CONFIRMED";
  readonly encryptionKeyRef: string;
  readonly now: Date;
}

export interface UpdatePersistenceInput {
  readonly id: string;
  readonly ownerId: string;
  readonly expectedVersion: number;
  readonly actorId: string;
  readonly categoryId: string;
  readonly importance: number;
  readonly sensitivity: string;
  readonly state: "ACTIVE" | "ARCHIVED";
  readonly verificationStatus: string;
  readonly userConfirmedAt: Date | null;
  readonly versionId: string;
  readonly versionNumber: number;
  readonly titleCiphertext: Buffer;
  readonly summaryCiphertext: Buffer;
  readonly purposeCiphertext: Buffer;
  readonly sourceType: string;
  readonly sourceRefCiphertext: Buffer | null;
  readonly originatedAt: Date | null;
  readonly confidence: number;
  readonly correctionReasonCiphertext: Buffer | null;
  readonly encryptionKeyRef: string;
  readonly linkOperations: readonly LinkPersistenceOperation[];
  readonly now: Date;
}

export type LinkPersistenceOperation =
  | {
      readonly operation: "CREATE";
      readonly id: string;
      readonly sourceId: string;
      readonly targetId: string;
      readonly relationshipType: string;
    }
  | { readonly operation: "DELETE"; readonly id: string; readonly expectedVersion: number };

export interface DeletePersistenceInput {
  readonly id: string;
  readonly ownerId: string;
  readonly expectedDeletionVersion: number;
  readonly deletedAt: Date;
  readonly purgeAfter: Date;
}

export interface IdempotencyScope {
  readonly environment: string;
  readonly principalId: string;
  readonly method: string;
  readonly routeTemplate: string;
  readonly keyHash: string;
}

export interface IdempotencyReplay {
  readonly requestHash: string;
  readonly state: "IN_PROGRESS" | "COMPLETED";
  readonly responseStatus: number | null;
  readonly responseBody: Buffer | null;
}
