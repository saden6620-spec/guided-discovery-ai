import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ApplicationException, ConflictException } from "@guided-discovery/errors";
import type { DomainEvent } from "@guided-discovery/events";
import type {
  DestinationRecord,
  NavigationRecord,
  Principal,
  RouteRecord,
} from "../domain/navigation.js";
import type {
  DestinationUpsertDto,
  RerouteNavigationDto,
  RouteUpsertDto,
  StartNavigationDto,
  StopNavigationDto,
} from "../presentation/schemas.js";
import {
  ENCRYPTION_ADAPTER,
  NAVIGATION_REPOSITORY,
  PERMISSION_GATEWAY,
  type EncryptionAdapter,
  type NavigationRepository,
  type PermissionGateway,
} from "./ports.js";
export interface RequestExecutionContext {
  principal: Principal;
  requestId: string;
  correlationId: string;
}

@Injectable()
export class NavigationApplicationService {
  constructor(
    @Inject(NAVIGATION_REPOSITORY) private readonly repository: NavigationRepository,
    @Inject(ENCRYPTION_ADAPTER) private readonly encryption: EncryptionAdapter,
    @Inject(PERMISSION_GATEWAY) private readonly permissions: PermissionGateway,
  ) {}
  async start(context: RequestExecutionContext, input: StartNavigationDto, key: string) {
    await this.permissions.authorize({
      principal: context.principal,
      action: "CREATE",
      resourceId: null,
      ownerId: context.principal.id,
      purpose: "navigation.start",
      sensitivity: "HIGHLY_SENSITIVE",
    });
    const destination = await this.repository.getDestination(input.destinationId);
    const route = await this.repository.getRoute(input.routeId);
    if (destination === null) throw missing("DESTINATION_NOT_FOUND", "Destination not found.");
    if (route === null || route.destinationId !== destination.id)
      throw missing("ROUTE_NOT_FOUND", "Route not found.");
    if (route.travelMode !== input.travelMode)
      throw new ConflictException(
        "ROUTE_TRAVEL_MODE_MISMATCH",
        "The route does not support the requested travel mode.",
      );
    const now = new Date();
    if (route.validUntil !== null && route.validUntil <= now)
      throw new ConflictException("ROUTE_EXPIRED", "The route is no longer valid.");
    const record: NavigationRecord = {
      id: randomUUID(),
      tripId: randomUUID(),
      ownerId: context.principal.id,
      destinationId: destination.id,
      routeId: route.id,
      travelMode: input.travelMode,
      tripState: "ACTIVE",
      sessionState: "ACTIVE",
      startedAt: now,
      stoppedAt: null,
      stopReason: null,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    const requestHash = hash(JSON.stringify(input));
    const result = await this.repository.start(
      record,
      [
        this.event("TripStarted", record, context, {
          tripId: record.tripId,
          navigationSessionId: record.id,
          destinationId: record.destinationId,
          routeId: record.routeId,
          travelMode: record.travelMode,
          startedAt: now.toISOString(),
        }),
      ],
      {
        environment: process.env.APP_ENV ?? "development",
        principalId: context.principal.id,
        routeTemplate: "/api/v1/navigation/start",
        keyHash: hash(key),
        requestHash,
      },
      this.encryption.encrypt(JSON.stringify(this.view(record))),
    );
    if ("state" in result) {
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
        NavigationApplicationService["view"]
      >;
    }
    return this.view(result);
  }
  async status(context: RequestExecutionContext, sessionId?: string) {
    const record =
      sessionId === undefined
        ? await this.repository.getActive(context.principal.id)
        : await this.repository.getSession(sessionId, context.principal.id);
    if (record === null) throw missing("RESOURCE_NOT_FOUND", "Navigation session not found.");
    await this.permissions.authorize({
      principal: context.principal,
      action: "READ",
      resourceId: record.id,
      ownerId: record.ownerId,
      purpose: "navigation.status",
      sensitivity: "HIGHLY_SENSITIVE",
    });
    return this.view(record);
  }
  async stop(context: RequestExecutionContext, input: StopNavigationDto, key: string) {
    const current = await this.required(context, input.sessionId, "navigation.stop");
    if (current.sessionState !== "ACTIVE") {
      if (current.stopReason === input.outcome) return this.view(current);
      throw new ConflictException(
        "NAVIGATION_TERMINAL_STATE_CONFLICT",
        "Navigation already has a different terminal outcome.",
      );
    }
    if (current.version !== input.expectedVersion)
      throw new ConflictException("VERSION_CONFLICT", "The navigation version has changed.");
    const now = new Date();
    const next = {
      ...current,
      tripState: input.outcome,
      sessionState: input.outcome,
      stoppedAt: now,
      stopReason: input.outcome,
      updatedAt: now,
      version: current.version + 1,
    } as NavigationRecord;
    const events = [
      this.event("NavigationStopped", next, context, {
        tripId: next.tripId,
        navigationSessionId: next.id,
        outcome: input.outcome,
        stoppedAt: now.toISOString(),
      }),
      this.event(input.outcome === "COMPLETED" ? "TripCompleted" : "TripCancelled", next, context, {
        tripId: next.tripId,
        navigationSessionId: next.id,
        endedAt: now.toISOString(),
      }),
    ];
    const result = await this.repository.stop(
      current.id,
      current.ownerId,
      input.outcome,
      input.expectedVersion,
      now,
      events,
      this.scope(context, "/api/v1/navigation/stop", key, input),
      this.encryption.encrypt(JSON.stringify(this.view(next))),
    );
    return this.replayOrView(result, hash(JSON.stringify(input)));
  }
  async reroute(context: RequestExecutionContext, input: RerouteNavigationDto, key: string) {
    const current = await this.required(context, input.sessionId, "navigation.reroute");
    if (current.sessionState !== "ACTIVE")
      throw new ConflictException(
        "INVALID_STATE_TRANSITION",
        "Only active navigation can be rerouted.",
      );
    const route = await this.repository.getRoute(input.replacementRouteId);
    if (route === null || route.destinationId !== current.destinationId)
      throw missing("ROUTE_NOT_FOUND", "Route not found.");
    if (route.travelMode !== current.travelMode)
      throw new ConflictException(
        "ROUTE_TRAVEL_MODE_MISMATCH",
        "The replacement route uses a different travel mode.",
      );
    if (current.routeId === route.id) return this.view(current);
    if (current.version !== input.expectedVersion)
      throw new ConflictException("VERSION_CONFLICT", "The navigation version has changed.");
    const now = new Date();
    const next = { ...current, routeId: route.id, updatedAt: now, version: current.version + 1 };
    const result = await this.repository.reroute(
      current.id,
      current.ownerId,
      route.id,
      input.expectedVersion,
      now,
      this.event("NavigationRerouted", next, context, {
        tripId: next.tripId,
        navigationSessionId: next.id,
        previousRouteId: current.routeId,
        routeId: route.id,
        reroutedAt: now.toISOString(),
      }),
      this.scope(context, "/api/v1/navigation/reroute", key, input),
      this.encryption.encrypt(JSON.stringify(this.view(next))),
    );
    return this.replayOrView(result, hash(JSON.stringify(input)));
  }
  async upsertDestination(
    context: RequestExecutionContext,
    id: string,
    input: DestinationUpsertDto,
  ) {
    requireScope(context.principal, "navigation.destination.write");
    const value: DestinationRecord = {
      id,
      ownerId: null,
      provider: input.provider,
      providerReference: input.providerReference,
      name: input.name,
      latitude: input.latitude.toFixed(7),
      longitude: input.longitude.toFixed(7),
      timezone: input.timezone,
      accessibility: input.accessibility,
      sourceVersion: input.sourceVersion,
      version: 1,
    };
    return this.repository.upsertDestination(value);
  }
  async upsertRoute(context: RequestExecutionContext, id: string, input: RouteUpsertDto) {
    requireScope(context.principal, "navigation.route.write");
    if (
      (await this.repository.getDestination(input.originDestinationId)) === null ||
      (await this.repository.getDestination(input.destinationId)) === null
    )
      throw missing("DESTINATION_NOT_FOUND", "Destination not found.");
    const value: RouteRecord = {
      id,
      ownerId: null,
      provider: input.provider,
      providerReference: input.providerReference,
      originDestinationId: input.originDestinationId,
      destinationId: input.destinationId,
      travelMode: input.travelMode,
      distanceMeters: input.distanceMeters,
      durationSeconds: input.durationSeconds,
      polyline: input.polyline,
      accessibility: input.accessibility,
      validFrom: new Date(input.validFrom),
      validUntil: input.validUntil == null ? null : new Date(input.validUntil),
      sourceVersion: input.sourceVersion,
      version: 1,
    };
    return this.repository.upsertRoute(value);
  }
  private async required(context: RequestExecutionContext, id: string, purpose: string) {
    const record = await this.repository.getSession(id, context.principal.id);
    if (record === null) throw missing("RESOURCE_NOT_FOUND", "Navigation session not found.");
    await this.permissions.authorize({
      principal: context.principal,
      action: "UPDATE",
      resourceId: id,
      ownerId: record.ownerId,
      purpose,
      sensitivity: "HIGHLY_SENSITIVE",
    });
    return record;
  }
  private view(value: NavigationRecord) {
    return {
      id: value.id,
      tripId: value.tripId,
      destinationId: value.destinationId,
      routeId: value.routeId,
      travelMode: value.travelMode,
      tripState: value.tripState,
      sessionState: value.sessionState,
      startedAt: value.startedAt.toISOString(),
      stoppedAt: value.stoppedAt?.toISOString() ?? null,
      stopReason: value.stopReason,
      createdAt: value.createdAt.toISOString(),
      updatedAt: value.updatedAt.toISOString(),
      version: value.version,
    };
  }
  private scope(
    context: RequestExecutionContext,
    routeTemplate: string,
    key: string,
    input: unknown,
  ) {
    return {
      environment: process.env.APP_ENV ?? "development",
      principalId: context.principal.id,
      routeTemplate,
      keyHash: hash(key),
      requestHash: hash(JSON.stringify(input)),
    };
  }
  private replayOrView(
    result: NavigationRecord | import("./ports.js").IdempotencyReplay,
    requestHash: string,
  ) {
    if (!("state" in result)) return this.view(result);
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
      NavigationApplicationService["view"]
    >;
  }
  private event(
    eventType: string,
    value: NavigationRecord,
    context: RequestExecutionContext,
    payload: Record<string, unknown>,
  ): DomainEvent {
    return {
      eventId: randomUUID(),
      eventType,
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      producer: "navigation-service",
      subjectType: eventType.startsWith("Trip") ? "TRIP" : "NAVIGATION_SESSION",
      subjectId: eventType.startsWith("Trip") ? value.tripId : value.id,
      subjectVersion: value.version,
      actorId: context.principal.id,
      ownerId: value.ownerId,
      correlationId: context.correlationId,
      payload,
    } as DomainEvent;
  }
}
function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
function missing(code: string, message: string) {
  return new ApplicationException({ code, message, httpStatus: 404 });
}
function requireScope(principal: Principal, scope: string) {
  if (principal.kind !== "SERVICE" || !principal.scopes.has(scope))
    throw new ApplicationException({
      code: "SERVICE_ACCESS_DENIED",
      message: "Service access is denied.",
      httpStatus: 403,
    });
}
