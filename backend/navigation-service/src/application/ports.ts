import type { DomainEvent } from "@guided-discovery/events";
import type {
  DestinationRecord,
  NavigationRecord,
  Principal,
  RouteRecord,
} from "../domain/navigation.js";
export const NAVIGATION_REPOSITORY = Symbol("NAVIGATION_REPOSITORY");
export const ENCRYPTION_ADAPTER = Symbol("ENCRYPTION_ADAPTER");
export const PERMISSION_GATEWAY = Symbol("PERMISSION_GATEWAY");
export const PRINCIPAL_RESOLVER = Symbol("PRINCIPAL_RESOLVER");
export interface EncryptionAdapter {
  encrypt(value: string): Buffer;
  decrypt(value: Buffer): string;
}
export interface PrincipalResolver {
  resolveUser(authorization: string | undefined): Promise<Principal>;
  resolveService(authorization: string | undefined): Promise<Principal>;
}
export interface PermissionGateway {
  authorize(input: {
    principal: Principal;
    action: "READ" | "CREATE" | "UPDATE";
    resourceId: string | null;
    ownerId: string | null;
    purpose: string;
    sensitivity?: "STANDARD" | "SENSITIVE" | "HIGHLY_SENSITIVE";
  }): Promise<void>;
}
export interface IdempotencyScope {
  environment: string;
  principalId: string;
  routeTemplate: string;
  keyHash: string;
  requestHash: string;
}
export interface IdempotencyReplay {
  requestHash: string;
  state: "IN_PROGRESS" | "COMPLETED";
  responseBody: Buffer | null;
}
export interface NavigationRepository {
  getSession(id: string, ownerId: string): Promise<NavigationRecord | null>;
  getActive(ownerId: string): Promise<NavigationRecord | null>;
  start(
    record: NavigationRecord,
    events: readonly DomainEvent[],
    idempotency: IdempotencyScope,
    encryptedResponse: Buffer,
  ): Promise<NavigationRecord | IdempotencyReplay>;
  stop(
    id: string,
    ownerId: string,
    outcome: "COMPLETED" | "CANCELLED",
    expectedVersion: number,
    now: Date,
    events: readonly DomainEvent[],
    idempotency: IdempotencyScope,
    encryptedResponse: Buffer,
  ): Promise<NavigationRecord | IdempotencyReplay>;
  reroute(
    id: string,
    ownerId: string,
    routeId: string,
    expectedVersion: number,
    now: Date,
    event: DomainEvent,
    idempotency: IdempotencyScope,
    encryptedResponse: Buffer,
  ): Promise<NavigationRecord | IdempotencyReplay>;
  getDestination(id: string): Promise<DestinationRecord | null>;
  getRoute(id: string): Promise<RouteRecord | null>;
  upsertDestination(
    value: DestinationRecord,
  ): Promise<{ record: DestinationRecord; created: boolean }>;
  upsertRoute(value: RouteRecord): Promise<{ record: RouteRecord; created: boolean }>;
  ping(signal: AbortSignal): Promise<void>;
  schemaIsCurrent(signal: AbortSignal): Promise<boolean>;
  close(): Promise<void>;
}
