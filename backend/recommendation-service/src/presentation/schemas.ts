import { z } from "zod";
import { recommendationStatuses, scoreFactors } from "../domain/recommendation.js";
const uuid = z
  .string()
  .uuid()
  .transform((v) => v.toLowerCase());
export const ResourceIdSchema = uuid;
export const VersionRequestSchema = z
  .object({ expectedVersion: z.number().int().min(1).max(2147483647) })
  .strict();
export const ListQuerySchema = z
  .object({
    cursor: z.string().min(1).max(4096).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    category: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]{1,63}$/u)
      .optional(),
    status: z.enum(recommendationStatuses).optional(),
  })
  .strict();
export const CreateRecommendationSchema = z
  .object({
    ownerId: uuid,
    category: z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/u),
    title: z.string().min(1).max(200),
    summary: z.string().min(1).max(5000),
    rationale: z.string().min(1).max(5000),
    confidence: z.number().min(0).max(1),
    availableAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
    permissionPolicyRef: z.string().min(1).max(128),
    permissionVersion: z.number().int().positive(),
    provenance: z
      .object({
        producer: z.string().regex(/^[a-z][a-z0-9-]{2,63}$/u),
        sourceType: z.enum(["USER_ACTION", "SERVICE_EVENT", "IMPORT", "TEST_FIXTURE"]),
        sourceResourceId: uuid.nullable().optional(),
        sourceVersion: z.number().int().positive(),
      })
      .strict(),
    scores: z
      .array(z.object({ factor: z.enum(scoreFactors), score: z.number().min(0).max(1) }).strict())
      .max(8),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.expiresAt != null && v.expiresAt <= v.availableAt)
      c.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "expiresAt must follow availableAt",
      });
    const factors = v.scores.map((s) => s.factor);
    if (new Set(factors).size !== factors.length)
      c.addIssue({ code: "custom", path: ["scores"], message: "score factors must be unique" });
  });
export type CreateRecommendationDto = z.infer<typeof CreateRecommendationSchema>;
