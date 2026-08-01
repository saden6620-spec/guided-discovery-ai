import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import {
  Body,
  Catch,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
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
  PlanningApplicationService,
  type RequestExecutionContext,
} from "../application/planning.service.js";
import { PRINCIPAL_RESOLVER, type PrincipalResolver } from "../application/ports.js";
import { Inject } from "@nestjs/common";
import {
  CreatePlanSchema,
  ListPlansQuerySchema,
  ResourceIdSchema,
  UpdatePlanSchema,
} from "./schemas.js";

@Controller("api/v1/plans")
export class PlanningController {
  constructor(
    private readonly planning: PlanningApplicationService,
    @Inject(PRINCIPAL_RESOLVER) private readonly principals: PrincipalResolver,
  ) {}
  @Get() async list(
    @Req() request: Request,
    @Query() query: unknown,
    @Headers("authorization") authorization?: string,
  ) {
    const context = await this.context(request, authorization);
    return {
      success: true,
      ...(await this.planning.list(context, parseRequest(ListPlansQuerySchema, query))),
    };
  }
  @Post() async create(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers("authorization") authorization: string | undefined,
    @Headers("idempotency-key") key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (key === undefined || key.length < 16 || key.length > 128 || !/^[!-~]+$/u.test(key))
      throw new ValidationException([
        {
          field: "header/Idempotency-Key",
          code: "INVALID_FORMAT",
          message: "Idempotency-Key must be 16-128 printable ASCII characters.",
        },
      ]);
    const context = await this.context(request, authorization);
    response.status(201);
    return {
      success: true,
      data: await this.planning.create(context, parseRequest(CreatePlanSchema, body), key),
      metadata: {},
    };
  }
  @Patch(":id") async update(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("authorization") authorization?: string,
  ) {
    const context = await this.context(request, authorization);
    return {
      success: true,
      data: await this.planning.update(
        context,
        parseRequest(ResourceIdSchema, id),
        parseRequest(UpdatePlanSchema, body),
      ),
      metadata: {},
    };
  }
  @Delete(":id") @HttpCode(204) async delete(
    @Req() request: Request,
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ): Promise<void> {
    const context = await this.context(request, authorization);
    await this.planning.delete(context, parseRequest(ResourceIdSchema, id));
  }
  private async context(
    request: Request,
    authorization: string | undefined,
  ): Promise<RequestExecutionContext> {
    const requestId = request.headers["x-request-id"]?.toString() ?? crypto.randomUUID();
    return {
      principal: await this.principals.resolve(authorization),
      requestId,
      correlationId: requestId,
    };
  }
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
