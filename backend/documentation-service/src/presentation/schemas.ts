import { z } from "zod";
const uuid = z
  .string()
  .uuid()
  .refine((v) => v === v.toLowerCase() && v !== "00000000-0000-0000-0000-000000000000");
const text = (max: number) => z.string().trim().min(1).max(max);
const timestamp = z.string().datetime({ offset: false });
const position = z.number().int().nonnegative();
const entryType = z.enum(["TEXT", "VOICE_REFERENCE", "PHOTO_REFERENCE", "VIDEO_REFERENCE"]);
const mediaKind = z.enum(["VOICE", "PHOTO", "VIDEO"]);
export const ResourceIdSchema = uuid;
export const ListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    tripId: uuid.optional(),
    startedFrom: timestamp.optional(),
    startedTo: timestamp.optional(),
  })
  .strict();
export const CreateEntrySchema = z
  .object({
    type: z.literal("TEXT"),
    content: text(50000),
    occurredAt: timestamp,
    locationReference: text(500).optional(),
    position,
  })
  .strict();
const PatchEntrySchema = z
  .object({
    type: entryType,
    content: text(50000).optional(),
    mediaReferenceId: uuid.optional(),
    mediaReferenceClientReference: text(64).optional(),
    occurredAt: timestamp,
    locationReference: text(500).optional(),
    position,
  })
  .strict()
  .superRefine((v, c) => {
    if (
      v.type === "TEXT"
        ? !v.content || v.mediaReferenceId || v.mediaReferenceClientReference
        : v.content ||
          (!v.mediaReferenceId && !v.mediaReferenceClientReference) ||
          (!!v.mediaReferenceId && !!v.mediaReferenceClientReference)
    )
      c.addIssue({ code: "custom", message: "CONTENT_MEDIA_EXCLUSIVE" });
  });
const ReflectionSchema = z
  .object({ entryId: uuid.optional(), text: text(10000), occurredAt: timestamp, position })
  .strict();
const MediaSchema = z
  .object({ mediaId: uuid, mediaKind, caption: text(1000).optional(), position })
  .strict();
const operation = <T extends z.ZodType>(value: T) =>
  z.discriminatedUnion("operation", [
    z.object({ operation: z.literal("CREATE"), clientReference: text(64), value }).strict(),
    z
      .object({
        operation: z.literal("UPDATE"),
        id: uuid,
        expectedVersion: z.number().int().positive(),
        value,
      })
      .strict(),
    z
      .object({
        operation: z.literal("DELETE"),
        id: uuid,
        expectedVersion: z.number().int().positive(),
      })
      .strict(),
  ]);
export const CreateJournalSchema = z
  .object({
    title: text(200),
    description: text(10000).optional(),
    tripId: uuid.optional(),
    startedAt: timestamp.optional(),
    endedAt: timestamp.optional(),
    entries: z.array(CreateEntrySchema).max(500).optional(),
  })
  .strict();
export const UpdateJournalSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    title: text(200).optional(),
    description: text(10000).optional(),
    tripId: uuid.optional(),
    startedAt: timestamp.optional(),
    endedAt: timestamp.optional(),
    entryOperations: z.array(operation(PatchEntrySchema)).max(500).optional(),
    reflectionOperations: z.array(operation(ReflectionSchema)).max(500).optional(),
    mediaOperations: z.array(operation(MediaSchema)).max(500).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 1, "PATCH_EMPTY");
export type CreateJournalDto = z.infer<typeof CreateJournalSchema>;
export type UpdateJournalDto = z.infer<typeof UpdateJournalSchema>;
export type ListJournalsQuery = z.infer<typeof ListQuerySchema>;
