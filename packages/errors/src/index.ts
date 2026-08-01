import type {
  ApiFailure,
  ApiFieldError,
  EmptyMetadata,
  RequestId,
} from "@guided-discovery/shared-types";

export interface ApplicationExceptionOptions<TMetadata extends object = EmptyMetadata> {
  readonly code: string;
  readonly message: string;
  readonly httpStatus: number;
  readonly fields?: readonly ApiFieldError[];
  readonly metadata?: TMetadata;
  readonly cause?: unknown;
  readonly retryable?: boolean;
}

export class ApplicationException<TMetadata extends object = EmptyMetadata> extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly fields?: readonly ApiFieldError[];
  readonly metadata: TMetadata;
  readonly retryable: boolean;

  constructor(options: ApplicationExceptionOptions<TMetadata>) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.code = options.code;
    this.httpStatus = options.httpStatus;
    if (options.fields !== undefined) this.fields = options.fields;
    this.metadata = (options.metadata ?? {}) as TMetadata;
    this.retryable = options.retryable ?? false;
  }
}

export class ValidationException extends ApplicationException {
  constructor(fields: readonly ApiFieldError[], message = "One or more fields are invalid.") {
    super({ code: "VALIDATION_FAILED", message, httpStatus: 422, fields });
  }
}

export class ConflictException<
  TMetadata extends object = EmptyMetadata,
> extends ApplicationException<TMetadata> {
  constructor(code: string, message: string, metadata?: TMetadata) {
    super({ code, message, httpStatus: 409, ...(metadata === undefined ? {} : { metadata }) });
  }
}

export class AuthorizationException extends ApplicationException {
  constructor(code: "AUTHENTICATION_REQUIRED" | "ACCESS_DENIED", message: string) {
    super({ code, message, httpStatus: code === "AUTHENTICATION_REQUIRED" ? 401 : 403 });
  }
}

export class InfrastructureException extends ApplicationException {
  constructor(
    code: string,
    message: string,
    options: { readonly cause?: unknown; readonly retryable?: boolean } = {},
  ) {
    super({ code, message, httpStatus: 503, ...options });
  }
}

export class InternalException extends ApplicationException {
  constructor(cause?: unknown) {
    super({
      code: "INTERNAL_ERROR",
      message: "An unexpected internal error occurred.",
      httpStatus: 500,
      ...(cause === undefined ? {} : { cause }),
    });
  }
}

export interface HttpErrorResult {
  readonly status: number;
  readonly body: ApiFailure<Record<string, unknown>>;
}

export function toHttpError(error: unknown, requestId: RequestId): HttpErrorResult {
  const exception = error instanceof ApplicationException ? error : new InternalException(error);
  return {
    status: exception.httpStatus,
    body: {
      success: false,
      error: {
        code: exception.code,
        message: exception.message,
        requestId,
        ...(exception.fields === undefined ? {} : { fields: exception.fields }),
      },
      metadata: exception.metadata as Record<string, unknown>,
    },
  };
}
