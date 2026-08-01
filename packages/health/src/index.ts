import type { DependencyHealth, HealthData, UtcTimestamp } from "@guided-discovery/shared-types";
import {
  NoopMetrics,
  Timing,
  createHealthMetrics,
  type HealthMetrics,
} from "@guided-discovery/telemetry";

export interface DependencyHealthCheck {
  readonly name: string;
  check(signal: AbortSignal): Promise<Omit<DependencyHealth, "name" | "latencyMilliseconds">>;
}

export interface HealthAggregatorOptions {
  readonly service: string;
  readonly version: string;
  readonly checks?: readonly DependencyHealthCheck[];
  readonly timeoutMilliseconds?: number;
  readonly metrics?: HealthMetrics;
  readonly now?: () => Date;
  readonly monotonicNow?: () => number;
}

export class HealthAggregator {
  private readonly service: string;
  private readonly version: string;
  private readonly checks: readonly DependencyHealthCheck[];
  private readonly timeoutMilliseconds: number;
  private readonly metrics: HealthMetrics;
  private readonly now: () => Date;
  private readonly monotonicNow: () => number;

  constructor(options: HealthAggregatorOptions) {
    this.service = options.service;
    this.version = options.version;
    this.checks = options.checks ?? [];
    this.timeoutMilliseconds = options.timeoutMilliseconds ?? 200;
    this.metrics = options.metrics ?? createHealthMetrics(new NoopMetrics());
    this.now = options.now ?? (() => new Date());
    this.monotonicNow = options.monotonicNow ?? (() => performance.now());
  }

  liveness(): HealthData {
    return this.result("UP");
  }

  versionInfo(): Readonly<{ service: string; version: string }> {
    return Object.freeze({ service: this.service, version: this.version });
  }

  async readiness(): Promise<HealthData> {
    const results = await Promise.all(this.checks.map((check) => this.runCheck(check)));
    return this.result(results.every((check) => check.status === "UP") ? "UP" : "DOWN", results);
  }

  private result(status: "UP" | "DOWN", checks?: readonly DependencyHealth[]): HealthData {
    return Object.freeze({
      status,
      service: this.service,
      version: this.version,
      timestamp: this.now().toISOString() as UtcTimestamp,
      ...(checks === undefined ? {} : { checks: Object.freeze(checks) }),
    });
  }

  private async runCheck(check: DependencyHealthCheck): Promise<DependencyHealth> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMilliseconds);
    const startedAt = this.monotonicNow();
    const timer = new Timing(this.metrics.duration, { dependency: check.name }, this.monotonicNow);
    try {
      const result = await check.check(controller.signal);
      this.metrics.checks.add(1, { dependency: check.name, outcome: result.status.toLowerCase() });
      return {
        name: check.name,
        latencyMilliseconds: Math.max(0, this.monotonicNow() - startedAt),
        ...result,
      };
    } catch {
      this.metrics.checks.add(1, { dependency: check.name, outcome: "down" });
      return {
        name: check.name,
        status: "DOWN",
        latencyMilliseconds: Math.max(0, this.monotonicNow() - startedAt),
        errorCode: controller.signal.aborted ? "HEALTH_CHECK_TIMEOUT" : "HEALTH_CHECK_FAILED",
      };
    } finally {
      clearTimeout(timeout);
      timer.stop();
    }
  }
}
