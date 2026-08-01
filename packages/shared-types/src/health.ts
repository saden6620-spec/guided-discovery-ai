import type { UtcTimestamp } from "./identifiers.js";

export type HealthStatus = "UP" | "DOWN";

export interface DependencyHealth {
  readonly name: string;
  readonly status: HealthStatus;
  readonly latencyMilliseconds: number;
  readonly errorCode?: string;
}

export interface HealthData {
  readonly status: HealthStatus;
  readonly service: string;
  readonly version: string;
  readonly timestamp: UtcTimestamp;
  readonly checks?: readonly DependencyHealth[];
}

export type ServiceHealth = HealthData;
