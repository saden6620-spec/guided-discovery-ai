import type { RequestId } from "./identifiers.js";

export interface EmptyMetadata {
  readonly [key: string]: never;
}

export interface ApiSuccess<TData, TMetadata extends object = EmptyMetadata> {
  readonly success: true;
  readonly data: TData;
  readonly metadata: TMetadata;
}

export interface ApiFieldError {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly requestId: RequestId;
  readonly fields?: readonly ApiFieldError[];
}

export interface ApiFailure<TMetadata extends object = EmptyMetadata> {
  readonly success: false;
  readonly error: ApiError;
  readonly metadata: TMetadata;
}

export type ApiResponse<TData, TMetadata extends object = EmptyMetadata> =
  ApiSuccess<TData, TMetadata> | ApiFailure<TMetadata>;

export interface PageMetadata {
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
  readonly limit: number;
}

export type PaginatedResponse<TData> = ApiSuccess<readonly TData[], PageMetadata>;
