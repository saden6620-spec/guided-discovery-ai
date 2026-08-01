import type {
  CorrelationId,
  EventId,
  ResourceId,
  UtcTimestamp,
  UserId,
} from "@guided-discovery/shared-types";

export interface DomainEvent<TPayload extends object = object> {
  readonly eventId: EventId;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly occurredAt: UtcTimestamp;
  readonly producer: string;
  readonly subjectType: string;
  readonly subjectId: ResourceId;
  readonly subjectVersion: number;
  readonly actorId?: UserId;
  readonly ownerId?: UserId;
  readonly correlationId: CorrelationId;
  readonly causationId?: EventId;
  readonly permissionVersion?: number;
  readonly deletionVersion?: number;
  readonly payload: Readonly<TPayload>;
}

export interface EventPublisher {
  publish(event: DomainEvent, signal?: AbortSignal): Promise<void>;
}

export interface EventSubscription {
  close(): Promise<void>;
}

export interface EventSubscriber {
  subscribe(
    eventType: string,
    handler: (event: DomainEvent, signal: AbortSignal) => Promise<void>,
  ): Promise<EventSubscription>;
}

export interface OutboxRecord {
  readonly event: DomainEvent;
  readonly availableAt: UtcTimestamp;
  readonly attemptCount: number;
}

export interface Outbox {
  append(event: DomainEvent): Promise<void>;
  pending(limit: number, signal?: AbortSignal): Promise<readonly OutboxRecord[]>;
  markPublished(eventId: EventId, publishedAt: UtcTimestamp): Promise<void>;
  markFailed(eventId: EventId, errorCode: string): Promise<void>;
}

export interface Inbox {
  hasProcessed(consumer: string, eventId: EventId): Promise<boolean>;
  recordProcessed(consumer: string, event: DomainEvent, resultCode: string): Promise<void>;
}

export interface EventSerializer {
  serialize(event: DomainEvent): Uint8Array;
  deserialize(value: Uint8Array): DomainEvent;
}

export class JsonEventSerializer implements EventSerializer {
  serialize(event: DomainEvent): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(event));
  }

  deserialize(value: Uint8Array): DomainEvent {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(value));
    if (parsed === null || typeof parsed !== "object")
      throw new Error("Event must be a JSON object.");
    const candidate = parsed as Partial<DomainEvent>;
    if (
      typeof candidate.eventId !== "string" ||
      typeof candidate.eventType !== "string" ||
      !Number.isInteger(candidate.eventVersion) ||
      typeof candidate.subjectId !== "string" ||
      !Number.isInteger(candidate.subjectVersion) ||
      candidate.payload === null ||
      typeof candidate.payload !== "object"
    ) {
      throw new Error("Event envelope is invalid.");
    }
    return parsed as DomainEvent;
  }
}

export function isCompatibleEventVersion(supportedMajor: number, eventVersion: number): boolean {
  return Number.isInteger(eventVersion) && eventVersion === supportedMajor && supportedMajor > 0;
}
