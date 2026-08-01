import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type { DomainEvent } from "@guided-discovery/events";
import type {
  ApiFailure,
  ApiSuccess,
  CorrelationId,
  EventId,
  HealthData,
  PageMetadata,
  RequestContext,
  RequestId,
  ResourceId,
  UtcTimestamp,
} from "@guided-discovery/shared-types";

function id<TIdentifier extends string>(): TIdentifier {
  return randomUUID() as TIdentifier;
}

export function createMockRequestContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return Object.freeze({
    requestId: id<RequestId>(),
    correlationId: id<CorrelationId>(),
    trace: { traceparent: `00-${randomUUID().replaceAll("-", "")}-0123456789abcdef-01` },
    serviceName: "test-service",
    startedAt: 0,
    ...overrides,
  });
}

export function createMockHealth(overrides: Partial<HealthData> = {}): HealthData {
  return Object.freeze({
    status: "UP",
    service: "test-service",
    version: "0.0.0-test",
    timestamp: "2026-08-01T00:00:00.000Z" as UtcTimestamp,
    ...overrides,
  });
}

export function createEvent<TPayload extends object>(
  eventType: string,
  payload: TPayload,
  overrides: Partial<DomainEvent<TPayload>> = {},
): DomainEvent<TPayload> {
  return Object.freeze({
    eventId: id<EventId>(),
    eventType,
    eventVersion: 1,
    occurredAt: "2026-08-01T00:00:00.000Z" as UtcTimestamp,
    producer: "test-service",
    subjectType: "TEST_RESOURCE",
    subjectId: id<ResourceId>(),
    subjectVersion: 1,
    correlationId: id<CorrelationId>(),
    payload: Object.freeze(payload),
    ...overrides,
  });
}

export function assertApiSuccess<TData>(
  value: ApiSuccess<TData, object>,
): asserts value is ApiSuccess<TData, object> {
  assert.equal(value.success, true);
  assert.ok(Object.hasOwn(value, "data"));
  assert.equal(typeof value.metadata, "object");
}

export function assertApiFailure(value: ApiFailure<object>, expectedCode?: string): void {
  assert.equal(value.success, false);
  assert.equal(typeof value.error.requestId, "string");
  if (expectedCode !== undefined) assert.equal(value.error.code, expectedCode);
}

export function assertPageMetadata(metadata: PageMetadata, expectedLimit?: number): void {
  assert.equal(typeof metadata.hasMore, "boolean");
  assert.ok(Number.isInteger(metadata.limit));
  assert.ok(metadata.limit >= 1 && metadata.limit <= 100);
  if (expectedLimit !== undefined) assert.equal(metadata.limit, expectedLimit);
  if (metadata.hasMore) assert.equal(typeof metadata.nextCursor, "string");
}

export function assertDomainEvent(event: DomainEvent, expectedType?: string): void {
  assert.ok(event.eventVersion > 0);
  assert.ok(event.subjectVersion > 0);
  assert.equal(typeof event.payload, "object");
  if (expectedType !== undefined) assert.equal(event.eventType, expectedType);
}

export function assertHealth(value: HealthData, expectedStatus: HealthData["status"]): void {
  assert.equal(value.status, expectedStatus);
  assert.ok(value.service.length > 0);
  assert.ok(value.version.length > 0);
}
