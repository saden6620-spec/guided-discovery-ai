import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import {
  Body,
  Catch,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { toHttpError, ValidationException } from "@guided-discovery/errors";
import type { RequestId } from "@guided-discovery/shared-types";
import { parseRequest } from "@guided-discovery/validation";
import {
  RecommendationApplicationService,
  type RequestExecutionContext,
} from "../application/recommendation.service.js";
import { PRINCIPAL_RESOLVER, type PrincipalResolver } from "../application/ports.js";
import {
  CreateRecommendationSchema,
  ListQuerySchema,
  ResourceIdSchema,
  VersionRequestSchema,
} from "./schemas.js";
@Controller("api/v1/recommendations")
export class RecommendationController {
  constructor(
    private readonly app: RecommendationApplicationService,
    @Inject(PRINCIPAL_RESOLVER) private readonly principals: PrincipalResolver,
  ) {}
  @Get() async list(@Req() r: Request, @Query() q: unknown, @Headers("authorization") a?: string) {
    const parsed = parseRequest(ListQuerySchema, q),
      result = await this.app.list(await this.context(r, a), parsed);
    return { success: true, ...result };
  }
  @Post(":id/accept") @HttpCode(200) async accept(
    @Req() r: Request,
    @Param("id") id: string,
    @Body() b: unknown,
    @Headers("authorization") a?: string,
    @Headers("idempotency-key") key?: string,
  ) {
    validateKey(key);
    return {
      success: true,
      data: await this.app.act(
        await this.context(r, a),
        parseRequest(ResourceIdSchema, id),
        parseRequest(VersionRequestSchema, b).expectedVersion,
        key,
        "ACCEPTED",
      ),
      metadata: {},
    };
  }
  @Post(":id/dismiss") @HttpCode(200) async dismiss(
    @Req() r: Request,
    @Param("id") id: string,
    @Body() b: unknown,
    @Headers("authorization") a?: string,
    @Headers("idempotency-key") key?: string,
  ) {
    validateKey(key);
    return {
      success: true,
      data: await this.app.act(
        await this.context(r, a),
        parseRequest(ResourceIdSchema, id),
        parseRequest(VersionRequestSchema, b).expectedVersion,
        key,
        "DISMISSED",
      ),
      metadata: {},
    };
  }
  private async context(r: Request, a?: string): Promise<RequestExecutionContext> {
    const id = r.headers["x-request-id"]?.toString() ?? crypto.randomUUID();
    return { principal: await this.principals.resolveUser(a), requestId: id, correlationId: id };
  }
}
@Controller("internal/v1")
export class InternalRecommendationController {
  constructor(
    private readonly app: RecommendationApplicationService,
    @Inject(PRINCIPAL_RESOLVER) private readonly principals: PrincipalResolver,
  ) {}
  @Post("recommendations") async create(
    @Req() r: Request,
    @Body() b: unknown,
    @Headers("authorization") a?: string,
    @Headers("idempotency-key") key?: string,
    @Res({ passthrough: true }) response?: Response,
  ) {
    validateKey(key);
    response?.status(201);
    const id = r.headers["x-request-id"]?.toString() ?? crypto.randomUUID(),
      principal = await this.principals.resolveService(a);
    return {
      success: true,
      data: await this.app.create(
        { principal, requestId: id, correlationId: id },
        parseRequest(CreateRecommendationSchema, b),
        key,
      ),
      metadata: {},
    };
  }
}
function validateKey(key: string | undefined): asserts key is string {
  if (!key || key.length < 16 || key.length > 128 || !/^[!-~]+$/u.test(key))
    throw new ValidationException([
      {
        field: "header/Idempotency-Key",
        code: "INVALID_FORMAT",
        message: "Idempotency-Key must be 16-128 printable ASCII characters.",
      },
    ]);
}
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>(),
      request = host.switchToHttp().getRequest<Request>(),
      id = (request.headers["x-request-id"]?.toString() ?? crypto.randomUUID()) as RequestId;
    response.setHeader("X-Request-ID", id);
    const mapped = toHttpError(error, id);
    response.status(mapped.status).json(mapped.body);
  }
}
