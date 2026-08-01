import type { RequestContext } from "@guided-discovery/shared-types";

export type LogSeverity = "debug" | "info" | "warn" | "error";
export type LogValue =
  string | number | boolean | null | readonly LogValue[] | { readonly [key: string]: LogValue };

export interface LogRecord {
  readonly timestamp: string;
  readonly severity: LogSeverity;
  readonly service: string;
  readonly event: string;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly correlationId?: string;
  readonly attributes: Readonly<Record<string, LogValue>>;
}

export interface LogSink {
  write(record: LogRecord): void;
}

export interface Logger {
  debug(event: string, attributes?: Readonly<Record<string, unknown>>): void;
  info(event: string, attributes?: Readonly<Record<string, unknown>>): void;
  warn(event: string, attributes?: Readonly<Record<string, unknown>>): void;
  error(event: string, attributes?: Readonly<Record<string, unknown>>): void;
  withContext(context: RequestContext): Logger;
}

const sensitiveKeys =
  /authorization|cookie|password|secret|token|content|body|query|coordinate|address/iu;

function safeValue(key: string, value: unknown, depth = 0): LogValue {
  if (sensitiveKeys.test(key)) return "[REDACTED]";
  if (depth >= 5) return "[TRUNCATED]";
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return typeof value === "string" && value.length > 2048 ? `${value.slice(0, 2048)}…` : value;
  }
  if (Array.isArray(value))
    return value.slice(0, 100).map((entry) => safeValue(key, entry, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([childKey, child]) => [childKey, safeValue(childKey, child, depth + 1)]),
    );
  }
  return String(value);
}

function extractTraceId(traceparent: string): string | undefined {
  return traceparent.split("-")[1];
}

export class StructuredLogger implements Logger {
  constructor(
    private readonly service: string,
    private readonly sink: LogSink,
    private readonly context?: RequestContext,
    private readonly now: () => Date = () => new Date(),
  ) {}

  debug(event: string, attributes: Readonly<Record<string, unknown>> = {}): void {
    this.write("debug", event, attributes);
  }
  info(event: string, attributes: Readonly<Record<string, unknown>> = {}): void {
    this.write("info", event, attributes);
  }
  warn(event: string, attributes: Readonly<Record<string, unknown>> = {}): void {
    this.write("warn", event, attributes);
  }
  error(event: string, attributes: Readonly<Record<string, unknown>> = {}): void {
    this.write("error", event, attributes);
  }

  withContext(context: RequestContext): Logger {
    return new StructuredLogger(this.service, this.sink, context, this.now);
  }

  private write(
    severity: LogSeverity,
    event: string,
    attributes: Readonly<Record<string, unknown>>,
  ): void {
    const safeAttributes = Object.fromEntries(
      Object.entries(attributes).map(([key, value]) => [key, safeValue(key, value)]),
    );
    const traceId =
      this.context === undefined ? undefined : extractTraceId(this.context.trace.traceparent);
    this.sink.write({
      timestamp: this.now().toISOString(),
      severity,
      service: this.service,
      event,
      ...(this.context === undefined
        ? {}
        : {
            requestId: this.context.requestId,
            correlationId: this.context.correlationId,
            ...(traceId === undefined ? {} : { traceId }),
          }),
      attributes: safeAttributes,
    });
  }
}
