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
import { toHttpError, ValidationException } from "@guided-discovery/errors";
import type { RequestId } from "@guided-discovery/shared-types";
import { parseRequest } from "@guided-discovery/validation";
import {
  DocumentationApplicationService,
  type RequestExecutionContext,
} from "../application/documentation.service.js";
import { PRINCIPAL_RESOLVER, type PrincipalResolver } from "../application/ports.js";
import {
  CreateJournalSchema,
  ListQuerySchema,
  ResourceIdSchema,
  UpdateJournalSchema,
} from "./schemas.js";
@Controller("api/v1/journals")
export class DocumentationController {
  constructor(
    private readonly app: DocumentationApplicationService,
    @Inject(PRINCIPAL_RESOLVER) private readonly principals: PrincipalResolver,
  ) {}
  @Get() async list(@Req() r: Request, @Query() q: unknown, @Headers("authorization") a?: string) {
    return {
      success: true,
      ...(await this.app.list(await this.context(r, a), parseRequest(ListQuerySchema, q))),
    };
  }
  @Post() async create(
    @Req() r: Request,
    @Body() b: unknown,
    @Headers("authorization") a?: string,
    @Headers("idempotency-key") key?: string,
    @Res({ passthrough: true }) response?: Response,
  ) {
    validateKey(key);
    response?.status(201);
    return {
      success: true,
      data: await this.app.create(
        await this.context(r, a),
        parseRequest(CreateJournalSchema, b),
        key,
      ),
      metadata: {},
    };
  }
  @Patch(":id") async update(
    @Req() r: Request,
    @Param("id") id: string,
    @Body() b: unknown,
    @Headers("authorization") a?: string,
  ) {
    return {
      success: true,
      data: await this.app.update(
        await this.context(r, a),
        parseRequest(ResourceIdSchema, id),
        parseRequest(UpdateJournalSchema, b),
      ),
      metadata: {},
    };
  }
  @Delete(":id") @HttpCode(204) async remove(
    @Req() r: Request,
    @Param("id") id: string,
    @Headers("authorization") a?: string,
  ) {
    await this.app.delete(await this.context(r, a), parseRequest(ResourceIdSchema, id));
  }
  private async context(r: Request, a?: string): Promise<RequestExecutionContext> {
    const id = r.headers["x-request-id"]?.toString() ?? crypto.randomUUID();
    return { principal: await this.principals.resolveUser(a), requestId: id, correlationId: id };
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
    response.setHeader("RateLimit-Limit", "100");
    response.setHeader("RateLimit-Remaining", "99");
    response.setHeader("RateLimit-Reset", "60");
    const mapped = toHttpError(error, id);
    response.status(mapped.status).json(mapped.body);
  }
}
