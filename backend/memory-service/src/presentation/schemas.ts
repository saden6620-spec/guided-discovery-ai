import { z } from "zod";

import {
  MEMORY_SENSITIVITIES,
  PUBLIC_MEMORY_STATES,
  RELATIONSHIP_TYPES,
} from "../domain/memory.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
function containsForbiddenControl(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return (
      (code >= 0 && code <= 8) ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
    );
  });
}

function humanText(maximum: number): z.ZodType<string> {
  return z
    .string()
    .transform((value) => value.normalize("NFC").trim())
    .pipe(
      z
        .string()
        .min(1)
        .max(maximum)
        .refine((value) => !containsForbiddenControl(value), "Control characters are forbidden."),
    );
}

export const ResourceIdSchema = z.string().regex(UUID_PATTERN);
export const ExpectedVersionSchema = z.number().int().min(1).max(2_147_483_647);

export const CreateMemorySchema = z.strictObject({
  title: humanText(200),
  summary: humanText(10_000),
  purpose: humanText(1000),
  categoryId: ResourceIdSchema,
  importance: z.number().min(0).max(1).default(0.5),
  sensitivity: z.enum(MEMORY_SENSITIVITIES),
  originatedAt: z.iso.datetime({ offset: false }).optional(),
  userConfirmed: z.boolean().default(false),
});

const CreateLinkSchema = z.strictObject({
  operation: z.literal("CREATE"),
  clientReference: z.string().min(1).max(64),
  targetMemoryId: ResourceIdSchema,
  relationshipType: z.enum(RELATIONSHIP_TYPES),
});
const DeleteLinkSchema = z.strictObject({
  operation: z.literal("DELETE"),
  id: ResourceIdSchema,
  expectedVersion: ExpectedVersionSchema,
});

export const UpdateMemorySchema = z
  .strictObject({
    expectedVersion: ExpectedVersionSchema,
    title: humanText(200).optional(),
    summary: humanText(10_000).optional(),
    purpose: humanText(1000).optional(),
    categoryId: ResourceIdSchema.optional(),
    importance: z.number().min(0).max(1).optional(),
    sensitivity: z.enum(MEMORY_SENSITIVITIES).optional(),
    userConfirmed: z.boolean().optional(),
    correctionReason: humanText(1000).optional(),
    state: z.enum(PUBLIC_MEMORY_STATES).optional(),
    linkOperations: z
      .array(z.discriminatedUnion("operation", [CreateLinkSchema, DeleteLinkSchema]))
      .max(100)
      .optional(),
  })
  .refine((value) => Object.keys(value).length >= 2, {
    message: "At least one change is required.",
  })
  .superRefine((value, context) => {
    if (
      value.correctionReason !== undefined &&
      value.title === undefined &&
      value.summary === undefined &&
      value.purpose === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["correctionReason"],
        message: "A correction must change content.",
      });
    }
    const operations = value.linkOperations ?? [];
    const references = operations
      .filter((operation) => operation.operation === "CREATE")
      .map((operation) => operation.clientReference);
    if (new Set(references).size !== references.length)
      context.addIssue({
        code: "custom",
        path: ["linkOperations"],
        message: "Client references must be unique.",
      });
    const ids = operations
      .filter((operation) => operation.operation === "DELETE")
      .map((operation) => operation.id);
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: "custom",
        path: ["linkOperations"],
        message: "A link may be mutated once per request.",
      });
  });

export const ListMemoriesQuerySchema = z.strictObject({
  cursor: z.string().min(16).max(4096).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  categoryId: ResourceIdSchema.optional(),
  sort: z.literal("createdAt").default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateMemoryDto = z.infer<typeof CreateMemorySchema>;
export type UpdateMemoryDto = z.infer<typeof UpdateMemorySchema>;
export type ListMemoriesQuery = z.infer<typeof ListMemoriesQuerySchema>;
