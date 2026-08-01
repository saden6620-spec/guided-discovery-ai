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
  Put,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { toHttpError, ValidationException } from "@guided-discovery/errors";
import type { RequestId } from "@guided-discovery/shared-types";
import { parseRequest } from "@guided-discovery/validation";
import {
  NavigationApplicationService,
  type RequestExecutionContext,
} from "../application/navigation.service.js";
import { PRINCIPAL_RESOLVER, type PrincipalResolver } from "../application/ports.js";
import {
  DestinationUpsertSchema,
  NavigationStatusQuerySchema,
  RerouteNavigationSchema,
  ResourceIdSchema,
  RouteUpsertSchema,
  StartNavigationSchema,
  StopNavigationSchema,
} from "./schemas.js";
@Controller("api/v1/navigation")
export class NavigationController {
  constructor(
    private readonly navigation: NavigationApplicationService,
    @Inject(PRINCIPAL_RESOLVER) private readonly principals: PrincipalResolver,
  ) {}
  @Post("start") async start(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers("authorization") authorization: string | undefined,
    @Headers("idempotency-key") key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    validateKey(key);
    const context = await this.context(request, authorization);
    response.status(201);
    return {
      success: true,
      data: await this.navigation.start(
        context,
        parseRequest(StartNavigationSchema, body),
        key as string,
      ),
      metadata: {},
    };
  }
  @Post("stop")
  @HttpCode(200)
  async stop(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers("authorization") authorization: string | undefined,
    @Headers("idempotency-key") key: string | undefined,
  ) {
    validateKey(key);
    return {
      success: true,
      data: await this.navigation.stop(
        await this.context(request, authorization),
        parseRequest(StopNavigationSchema, body),
        key,
      ),
      metadata: {},
    };
  }
  @Get("status") async status(
    @Req() request: Request,
    @Query() query: unknown,
    @Headers("authorization") authorization: string | undefined,
  ) {
    const parsed = parseRequest(NavigationStatusQuerySchema, query);
    return {
      success: true,
      data: await this.navigation.status(
        await this.context(request, authorization),
        parsed.sessionId,
      ),
      metadata: {},
    };
  }
  @Post("reroute")
  @HttpCode(200)
  async reroute(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers("authorization") authorization: string | undefined,
    @Headers("idempotency-key") key: string | undefined,
  ) {
    validateKey(key);
    return {
      success: true,
      data: await this.navigation.reroute(
        await this.context(request, authorization),
        parseRequest(RerouteNavigationSchema, body),
        key,
      ),
      metadata: {},
    };
  }
  private async context(
    request: Request,
    authorization?: string,
  ): Promise<RequestExecutionContext> {
    const requestId = request.headers["x-request-id"]?.toString() ?? crypto.randomUUID();
    return {
      principal: await this.principals.resolveUser(authorization),
      requestId,
      correlationId: requestId,
    };
  }
}
@Controller("internal/v1")
export class InternalNavigationController {
  constructor(
    private readonly navigation: NavigationApplicationService,
    @Inject(PRINCIPAL_RESOLVER) private readonly principals: PrincipalResolver,
  ) {}
  @Put("destinations/:destinationId") async destination(
    @Req() request: Request,
    @Param("destinationId") id: string,
    @Body() body: unknown,
    @Headers("authorization") authorization: string | undefined,
    @Headers("idempotency-key") key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    validateKey(key);
    const result = await this.navigation.upsertDestination(
      await this.context(request, authorization),
      parseRequest(ResourceIdSchema, id),
      parseRequest(DestinationUpsertSchema, body),
    );
    response.status(result.created ? 201 : 200);
    return { success: true, data: result.record, metadata: {} };
  }
  @Put("routes/:routeId") async route(
    @Req() request: Request,
    @Param("routeId") id: string,
    @Body() body: unknown,
    @Headers("authorization") authorization: string | undefined,
    @Headers("idempotency-key") key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    validateKey(key);
    const result = await this.navigation.upsertRoute(
      await this.context(request, authorization),
      parseRequest(ResourceIdSchema, id),
      parseRequest(RouteUpsertSchema, body),
    );
    response.status(result.created ? 201 : 200);
    return { success: true, data: { ...result.record, polyline: undefined }, metadata: {} };
  }
  private async context(
    request: Request,
    authorization?: string,
  ): Promise<RequestExecutionContext> {
    const requestId = request.headers["x-request-id"]?.toString() ?? crypto.randomUUID();
    return {
      principal: await this.principals.resolveService(authorization),
      requestId,
      correlationId: requestId,
    };
  }
}
function validateKey(key: string | undefined): asserts key is string {
  if (key === undefined || key.length < 16 || key.length > 128 || !/^[!-~]+$/u.test(key))
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
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const requestId = (request.headers["x-request-id"]?.toString() ??
      crypto.randomUUID()) as RequestId;
    response.setHeader("X-Request-ID", requestId);
    const mapped = toHttpError(error, requestId);
    response.status(mapped.status).json(mapped.body);
  }
}
