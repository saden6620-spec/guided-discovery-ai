import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import {
  Body,
  Catch,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";

import { ApplicationException, toHttpError, ValidationException } from "@guided-discovery/errors";
import type { RequestId } from "@guided-discovery/shared-types";

import {
  MemoryApplicationService,
  type RequestExecutionContext,
} from "../application/memory.service.js";
import {
  MEMORY_REPOSITORY,
  PRINCIPAL_RESOLVER,
  type MemoryRepository,
  type PrincipalResolver,
} from "../application/ports.js";
import { parseRequest } from "@guided-discovery/validation";

import {
  CreateMemorySchema,
  ListMemoriesQuerySchema,
  ResourceIdSchema,
  UpdateMemorySchema,
} from "./schemas.js";

@Controller("api/v1/memories")
export class MemoryController {
  constructor(
    private readonly memories: MemoryApplicationService,
    @Inject(PRINCIPAL_RESOLVER) private readonly principals: PrincipalResolver,
  ) {}
  @Get() async list(
    @Req() request: Request,
    @Query() query: unknown,
    @Headers("authorization") authorization?: string,
  ) {
    const context = await this.context(request, authorization);
    const result = await this.memories.list(context, parseRequest(ListMemoriesQuerySchema, query));
    return { success: true, ...result };
  }
  @Get(":id") async get(
    @Req() request: Request,
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    const context = await this.context(request, authorization);
    return {
      success: true,
      data: await this.memories.get(context, parseRequest(ResourceIdSchema, id)),
      metadata: {},
    };
  }
  @Post() async create(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers("authorization") authorization: string | undefined,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (
      idempotencyKey === undefined ||
      idempotencyKey.length < 16 ||
      idempotencyKey.length > 128 ||
      !/^[!-~]+$/u.test(idempotencyKey)
    )
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
      data: await this.memories.create(
        context,
        parseRequest(CreateMemorySchema, body),
        idempotencyKey,
      ),
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
      data: await this.memories.update(
        context,
        parseRequest(ResourceIdSchema, id),
        parseRequest(UpdateMemorySchema, body),
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
    await this.memories.delete(context, parseRequest(ResourceIdSchema, id));
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

@Controller("internal/v1/memory-categories")
export class MemoryCategoryController {
  constructor(
    @Inject(MEMORY_REPOSITORY) private readonly repository: MemoryRepository,
    @Inject(PRINCIPAL_RESOLVER) private readonly principals: PrincipalResolver,
  ) {}
  @Get() async list(@Headers("authorization") authorization?: string) {
    const principal = await this.principals.resolve(authorization);
    if (principal.kind !== "SERVICE" && !((process.env.APP_ENV ?? "development") === "test"))
      throw new ApplicationException({
        code: "SERVICE_ACCESS_DENIED",
        message: "Service access is required.",
        httpStatus: 403,
      });
    return { success: true, data: await this.repository.listCategories(), metadata: {} };
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
