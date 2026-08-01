import type { CorrelationId, RequestId, UserId } from "./identifiers.js";

export interface TraceContext {
  readonly traceparent: string;
  readonly tracestate?: string;
}

export interface RequestContext {
  readonly requestId: RequestId;
  readonly correlationId: CorrelationId;
  readonly trace: TraceContext;
  readonly serviceName: string;
  readonly principalId?: UserId;
  readonly startedAt: number;
}

export interface PermissionReference {
  readonly policyRef: string;
  readonly policyVersion: number;
  readonly permissionVersion: number;
}

export interface PolicyReference {
  readonly policyRef: string;
  readonly policyVersion: number;
}
