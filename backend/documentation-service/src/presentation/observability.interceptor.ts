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
import type { CorrelationId, RequestContext, RequestId } from "@guided-discovery/shared-types";
import { NoopMetrics, Timing, type Metrics } from "@guided-discovery/telemetry";
import { RequestIdSchema, TraceparentSchema } from "@guided-discovery/validation";
class NestLogSink implements LogSink {
  private readonly logger = new Logger("DocumentationService");
  write(record: LogRecord) {
    const value = JSON.stringify(record);
    if (record.severity === "error") this.logger.error(value);
    else if (record.severity === "warn") this.logger.warn(value);
    else this.logger.log(value);
  }
}
@Injectable()
export class RequestObservabilityInterceptor implements NestInterceptor {
  private readonly base = new StructuredLogger("documentation-service", new NestLogSink());
  private readonly metrics: Metrics = new NoopMetrics();
  private readonly duration = this.metrics.histogram(
    "gda_http_request_duration_seconds",
    "HTTP duration",
  );
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>(),
      response = context.switchToHttp().getResponse<Response>(),
      supplied = request.headers["x-request-id"]?.toString(),
      requestId = (
        RequestIdSchema.safeParse(supplied).success ? supplied : randomUUID()
      ) as RequestId,
      suppliedTrace = request.headers.traceparent?.toString(),
      traceparent = TraceparentSchema.safeParse(suppliedTrace).success
        ? suppliedTrace
        : `00-${randomBytes(16).toString("hex")}-${randomBytes(8).toString("hex")}-01`;
    request.headers["x-request-id"] = requestId;
    response.setHeader("X-Request-ID", requestId);
    response.setHeader("RateLimit-Limit", "100");
    response.setHeader("RateLimit-Remaining", "99");
    response.setHeader("RateLimit-Reset", String(Math.ceil(Date.now() / 1000) + 60));
    const logger = this.base.withContext({
        requestId,
        correlationId: requestId as unknown as CorrelationId,
        trace: { traceparent },
        serviceName: "documentation-service",
        startedAt: performance.now(),
      } as RequestContext),
      timing = new Timing(this.duration, { method: request.method, route: request.path });
    logger.info("http.request.started", { method: request.method, route: request.path });
    return next.handle().pipe(
      finalize(() => {
        timing.stop();
        logger.info("http.request.completed", {
          method: request.method,
          route: request.path,
          status: response.statusCode,
        });
      }),
    );
  }
}
