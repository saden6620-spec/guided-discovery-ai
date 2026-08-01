export type MetricLabels = Readonly<Record<string, string>>;

export interface Counter {
  add(value?: number, labels?: MetricLabels): void;
}

export interface Histogram {
  record(value: number, labels?: MetricLabels): void;
}

export interface Metrics {
  counter(name: string, description: string): Counter;
  histogram(name: string, description: string): Histogram;
}

export interface Span {
  setAttribute(name: string, value: string | number | boolean): void;
  recordException(error: unknown): void;
  end(): void;
}

export interface Tracer {
  startSpan(name: string, attributes?: Readonly<Record<string, string | number | boolean>>): Span;
}

const noopCounter: Counter = Object.freeze({ add: () => undefined });
const noopHistogram: Histogram = Object.freeze({ record: () => undefined });
const noopSpan: Span = Object.freeze({
  setAttribute: () => undefined,
  recordException: () => undefined,
  end: () => undefined,
});

export class NoopMetrics implements Metrics {
  counter(): Counter {
    return noopCounter;
  }
  histogram(): Histogram {
    return noopHistogram;
  }
}

export class NoopTracer implements Tracer {
  startSpan(): Span {
    return noopSpan;
  }
}

export class Timing {
  private readonly startedAt: number;
  private stopped = false;

  constructor(
    private readonly histogram: Histogram,
    private readonly labels: MetricLabels = {},
    now: () => number = () => performance.now(),
  ) {
    this.now = now;
    this.startedAt = now();
  }

  private readonly now: () => number;

  stop(): number {
    if (this.stopped) throw new Error("Timing has already been stopped.");
    this.stopped = true;
    const seconds = Math.max(0, this.now() - this.startedAt) / 1000;
    this.histogram.record(seconds, this.labels);
    return seconds;
  }
}

export interface RequestMetrics {
  readonly requests: Counter;
  readonly duration: Histogram;
}

export interface HealthMetrics {
  readonly checks: Counter;
  readonly duration: Histogram;
}

export function createRequestMetrics(metrics: Metrics): RequestMetrics {
  return {
    requests: metrics.counter("gda_http_requests_total", "HTTP requests by bounded route labels."),
    duration: metrics.histogram(
      "gda_http_request_duration_seconds",
      "HTTP request duration in seconds.",
    ),
  };
}

export function createHealthMetrics(metrics: Metrics): HealthMetrics {
  return {
    checks: metrics.counter("gda_health_checks_total", "Health checks by type and outcome."),
    duration: metrics.histogram(
      "gda_health_check_duration_seconds",
      "Health check duration in seconds.",
    ),
  };
}
