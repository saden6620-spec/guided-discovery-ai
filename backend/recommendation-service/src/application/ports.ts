import type {
  RecommendationRecord,
  Principal,
  RecommendationStatus,
} from "../domain/recommendation.js";
export const RECOMMENDATION_REPOSITORY = Symbol("RECOMMENDATION_REPOSITORY"),
  ENCRYPTION_ADAPTER = Symbol("ENCRYPTION_ADAPTER"),
  PERMISSION_GATEWAY = Symbol("PERMISSION_GATEWAY"),
  PRINCIPAL_RESOLVER = Symbol("PRINCIPAL_RESOLVER");
export interface EncryptionAdapter {
  encrypt(value: string): Buffer;
  decrypt(value: Buffer): string;
}
export interface PrincipalResolver {
  resolveUser(value?: string): Promise<Principal>;
  resolveService(value?: string): Promise<Principal>;
}
export interface PermissionDecision {
  policyRef: string;
  permissionVersion: number;
}
export interface PermissionGateway {
  authorize(input: {
    principal: Principal;
    action: "READ" | "CREATE" | "UPDATE";
    resourceId: string | null;
    ownerId: string;
    purpose: string;
    permissionPolicyRef: string;
    requestedPermissionVersion: number;
  }): Promise<PermissionDecision>;
}
export interface IdempotencyScope {
  principalId: string;
  routeTemplate: string;
  keyHash: string;
  requestHash: string;
}
export interface RecommendationRepository {
  list(
    ownerId: string,
    input: {
      limit: number;
      category?: string;
      status?: RecommendationStatus;
      before?: { availableAt: Date; id: string };
    },
  ): Promise<RecommendationRecord[]>;
  get(id: string, ownerId: string): Promise<RecommendationRecord | null>;
  create(
    value: RecommendationRecord,
    scope: IdempotencyScope,
    response: Buffer,
  ): Promise<RecommendationRecord | Buffer>;
  transition(input: {
    id: string;
    ownerId: string;
    toStatus: "ACCEPTED" | "DISMISSED" | "EXPIRED";
    expectedVersion: number;
    actorType: "USER" | "SYSTEM";
    actorId: string | null;
    scope?: IdempotencyScope;
    response?: Buffer;
  }): Promise<RecommendationRecord | Buffer>;
  ping(signal: AbortSignal): Promise<void>;
  schemaIsCurrent(signal: AbortSignal): Promise<boolean>;
  close(): Promise<void>;
}
