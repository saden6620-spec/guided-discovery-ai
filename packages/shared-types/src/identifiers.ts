/** Opaque identifier branding prevents accidental cross-resource assignment. */
export type Identifier<Kind extends string> = string & { readonly __identifierKind: Kind };

export type ResourceId = Identifier<"Resource">;
export type UserId = Identifier<"User">;
export type RequestId = string & { readonly __requestId: true };
export type CorrelationId = string & { readonly __correlationId: true };
export type EventId = Identifier<"Event">;

export type UtcTimestamp = string & { readonly __utcTimestamp: true };

export interface VersionedResource {
  readonly version: number;
}
