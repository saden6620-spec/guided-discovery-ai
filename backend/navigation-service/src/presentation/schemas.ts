import { z } from "zod";
const uuid = z
  .string()
  .uuid()
  .transform((value) => value.toLowerCase());
const provider = z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/u);
const accessibility = z
  .object({
    wheelchairAccessible: z.boolean(),
    stepFree: z.boolean(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .strict();
export const ResourceIdSchema = uuid;
export const StartNavigationSchema = z
  .object({
    destinationId: uuid,
    routeId: uuid,
    travelMode: z.enum(["WALKING", "CYCLING", "DRIVING", "TRANSIT", "OTHER"]),
  })
  .strict();
export const StopNavigationSchema = z
  .object({
    sessionId: uuid,
    outcome: z.enum(["COMPLETED", "CANCELLED"]),
    expectedVersion: z.number().int().min(1).max(2147483647),
  })
  .strict();
export const RerouteNavigationSchema = z
  .object({
    sessionId: uuid,
    replacementRouteId: uuid,
    reason: z.string().max(500).optional(),
    expectedVersion: z.number().int().min(1).max(2147483647),
  })
  .strict();
export const NavigationStatusQuerySchema = z.object({ sessionId: uuid.optional() }).strict();
export const DestinationUpsertSchema = z
  .object({
    provider,
    providerReference: z.string().min(1).max(256),
    name: z.string().min(1).max(200),
    latitude: z.number().min(-90).max(90).multipleOf(0.0000001),
    longitude: z.number().min(-180).max(180).multipleOf(0.0000001),
    timezone: z.string().min(1).max(64),
    accessibility,
    sourceVersion: z.number().int().positive(),
  })
  .strict();
export const RouteUpsertSchema = z
  .object({
    provider,
    providerReference: z.string().min(1).max(256),
    originDestinationId: uuid,
    destinationId: uuid,
    travelMode: z.enum(["WALKING", "CYCLING", "DRIVING", "TRANSIT", "OTHER"]),
    distanceMeters: z.number().int().min(0).max(100000000),
    durationSeconds: z.number().int().min(0).max(604800),
    polyline: z.string().min(1).max(1000000),
    accessibility,
    validFrom: z.string().datetime({ offset: true }),
    validUntil: z.string().datetime({ offset: true }).nullable().optional(),
    sourceVersion: z.number().int().positive(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.validUntil != null && value.validUntil <= value.validFrom)
      context.addIssue({
        code: "custom",
        path: ["validUntil"],
        message: "validUntil must follow validFrom",
      });
  });
export type StartNavigationDto = z.infer<typeof StartNavigationSchema>;
export type StopNavigationDto = z.infer<typeof StopNavigationSchema>;
export type RerouteNavigationDto = z.infer<typeof RerouteNavigationSchema>;
export type DestinationUpsertDto = z.infer<typeof DestinationUpsertSchema>;
export type RouteUpsertDto = z.infer<typeof RouteUpsertSchema>;
