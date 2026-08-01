import { ValidationException } from "@guided-discovery/errors";
import { z } from "zod";

export const ResourceIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
export const UtcTimestampSchema = z.iso.datetime({ offset: false, precision: 3 });
export const CursorSchema = z
  .string()
  .min(16)
  .max(4096)
  .regex(/^[!-~]+$/u);
export const PaginationQuerySchema = z.object({
  cursor: CursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export const RequestIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[!-~]+$/u);
export const TraceparentSchema = z
  .string()
  .regex(/^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/u);
export const VersionSchema = z.number().int().min(1).max(2_147_483_647);

function pointer(path: readonly PropertyKey[]): string {
  if (path.length === 0) return "/";
  return `/${path
    .map((part) => String(part).replaceAll("~", "~0").replaceAll("/", "~1"))
    .join("/")}`;
}

export function parseRequest<TOutput>(schema: z.ZodType<TOutput>, input: unknown): TOutput {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new ValidationException(
    result.error.issues.map((issue) => ({
      field: pointer(issue.path),
      code: issue.code.toUpperCase(),
      message: issue.message,
    })),
  );
}

export function parseResponse<TOutput>(schema: z.ZodType<TOutput>, input: unknown): TOutput {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new Error("Response contract validation failed.", { cause: result.error });
}

export function createValidator<TOutput>(schema: z.ZodType<TOutput>): (input: unknown) => TOutput {
  return (input) => parseRequest(schema, input);
}

export function validatePagination(input: unknown): z.infer<typeof PaginationQuerySchema> {
  return parseRequest(PaginationQuerySchema, input);
}
