export const NAVIGATION_STATES = ["ACTIVE", "COMPLETED", "CANCELLED"] as const;
export const TRAVEL_MODES = ["WALKING", "CYCLING", "DRIVING", "TRANSIT", "OTHER"] as const;
export type NavigationState = (typeof NAVIGATION_STATES)[number];
export type TravelMode = (typeof TRAVEL_MODES)[number];
export interface Principal {
  readonly id: string;
  readonly kind: "USER" | "SERVICE";
  readonly scopes: ReadonlySet<string>;
}
export interface DestinationRecord {
  readonly id: string;
  readonly ownerId: string | null;
  readonly provider: string;
  readonly providerReference: string;
  readonly name: string;
  readonly latitude: string;
  readonly longitude: string;
  readonly timezone: string;
  readonly accessibility: Record<string, unknown>;
  readonly sourceVersion: number;
  readonly version: number;
}
export interface RouteRecord {
  readonly id: string;
  readonly ownerId: string | null;
  readonly provider: string;
  readonly providerReference: string;
  readonly originDestinationId: string;
  readonly destinationId: string;
  readonly travelMode: TravelMode;
  readonly distanceMeters: number;
  readonly durationSeconds: number;
  readonly polyline: string;
  readonly accessibility: Record<string, unknown>;
  readonly validFrom: Date;
  readonly validUntil: Date | null;
  readonly sourceVersion: number;
  readonly version: number;
}
export interface NavigationRecord {
  readonly id: string;
  readonly tripId: string;
  readonly ownerId: string;
  readonly destinationId: string;
  readonly routeId: string;
  readonly travelMode: TravelMode;
  readonly tripState: NavigationState;
  readonly sessionState: NavigationState;
  readonly startedAt: Date;
  readonly stoppedAt: Date | null;
  readonly stopReason: "COMPLETED" | "CANCELLED" | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}
