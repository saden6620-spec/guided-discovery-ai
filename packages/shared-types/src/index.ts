export type {
  ApiError,
  ApiFailure,
  ApiFieldError,
  ApiResponse,
  ApiSuccess,
  EmptyMetadata,
  PageMetadata,
  PaginatedResponse,
} from "./api.js";
export type {
  PermissionReference,
  PolicyReference,
  RequestContext,
  TraceContext,
} from "./context.js";
export type { DependencyHealth, HealthData, HealthStatus, ServiceHealth } from "./health.js";
export type {
  CorrelationId,
  EventId,
  Identifier,
  RequestId,
  ResourceId,
  UserId,
  UtcTimestamp,
  VersionedResource,
} from "./identifiers.js";

export interface DatabaseConnectionConfiguration {
  readonly connectionUrl?: string;
  readonly connectOnStartup: boolean;
}

export interface AuthenticationVerifier {
  verifyCredential(credential: string): Promise<unknown>;
}

export interface PluginDescriptor {
  readonly id: string;
  readonly version: string;
}
