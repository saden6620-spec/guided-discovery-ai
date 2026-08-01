import { randomBytes, randomUUID } from "node:crypto";
import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { finalize, type Observable } from "rxjs";
import { StructuredLogger, type LogRecord, type LogSink } from "@guided-discovery/logging";
import type {
  CorrelationId,
  RequestContext,
  RequestId,
  UtcTimestamp,
} from "@guided-discovery/shared-types";
import { NoopMetrics, Timing, type Metrics } from "@guided-discovery/telemetry";
import { RequestIdSchema, TraceparentSchema } from "@guided-discovery/validation";
class NestLogSink implements LogSink {
  private readonly logger = new Logger("NavigationService");
  write(record: LogRecord): void {
    const value = JSON.stringify(record);
    if (record.severity === "error") this.logger.error(value);
    else if (record.severity === "warn") this.logger.warn(value);
    else if (record.severity === "debug") this.logger.debug(value);
    else this.logger.log(value);
  }
}
@Injectable()
export class RequestObservabilityInterceptor implements NestInterceptor {
  private readonly baseLogger = new StructuredLogger("navigation-service", new NestLogSink());
  private readonly metrics: Metrics = new NoopMetrics();
  private readonly duration = this.metrics.histogram(
    "gda_http_request_duration_seconds",
    "HTTP request duration in seconds.",
  );
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const suppliedId = request.headers["x-request-id"]?.toString();
    const requestId = (
      RequestIdSchema.safeParse(suppliedId).success ? suppliedId : randomUUID()
    ) as RequestId;
    const suppliedTrace = request.headers.traceparent?.toString();
    const traceparent = TraceparentSchema.safeParse(suppliedTrace).success
      ? suppliedTrace
      : `00-${randomBytes(16).toString("hex")}-${randomBytes(8).toString("hex")}-01`;
    request.headers["x-request-id"] = requestId;
    response.setHeader("X-Request-ID", requestId);
    response.setHeader("RateLimit-Limit", "120");
    response.setHeader("RateLimit-Remaining", "119");
    response.setHeader("RateLimit-Reset", String(Math.ceil(Date.now() / 1000) + 60));
    const requestContext = {
      requestId,
      correlationId: requestId as unknown as CorrelationId,
      trace: { traceparent },
      serviceName: "navigation-service",
      startedAt: performance.now(),
    } as RequestContext;
    const logger = this.baseLogger.withContext(requestContext);
    const timing = new Timing(this.duration, {
      method: request.method,
      route: request.route?.path?.toString() ?? request.path,
    });
    logger.info("http.request.started", {
      method: request.method,
      route: request.path,
      traceContextValid:
        suppliedTrace === undefined || TraceparentSchema.safeParse(suppliedTrace).success,
    });
    return next.handle().pipe(
      finalize(() => {
        timing.stop();
        logger.info("http.request.completed", {
          method: request.method,
          route: request.route?.path?.toString() ?? request.path,
          status: response.statusCode,
          timestamp: new Date().toISOString() as UtcTimestamp,
        });
      }),
    );
  }
}
