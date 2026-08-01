import { z } from "zod";

import {
  CHECKLIST_STATUSES,
  ITEM_STATUSES,
  PLAN_STATUSES,
  RESERVATION_STATUSES,
} from "../domain/plan.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const MONEY_PATTERN = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$/u;
const CURRENCY_PATTERN = /^[A-Z]{3}$/u;
export const ResourceIdSchema = z.string().regex(UUID_PATTERN);
export const ExpectedVersionSchema = z.number().int().min(1).max(2_147_483_647);

function humanText(maximum: number): z.ZodType<string> {
  return z
    .string()
    .transform((value) => value.normalize("NFC").trim())
    .pipe(z.string().min(1).max(maximum));
}
const nullableDateTime = z.iso.datetime({ offset: false }).optional();
const position = z.number().int().min(0);

export const PlanItemInputSchema = z.strictObject({
  title: humanText(200),
  position,
  startsAt: nullableDateTime,
  endsAt: nullableDateTime,
  locationReference: humanText(500).optional(),
  notes: humanText(10_000).optional(),
  status: z.enum(ITEM_STATUSES).default("PLANNED"),
});
export const ReservationInputSchema = z.strictObject({
  providerName: humanText(200),
  reference: humanText(500).optional(),
  startsAt: nullableDateTime,
  endsAt: nullableDateTime,
  status: z.enum(RESERVATION_STATUSES).default("PLANNED"),
});
export const ChecklistInputSchema = z.strictObject({
  title: humanText(200),
  position,
  status: z.enum(CHECKLIST_STATUSES).default("PENDING"),
});

const createOperation = <T extends z.ZodType>(value: T) =>
  z.strictObject({
    operation: z.literal("CREATE"),
    clientReference: z.string().min(1).max(64),
    value,
  });
const updateOperation = <T extends z.ZodType>(value: T) =>
  z.strictObject({
    operation: z.literal("UPDATE"),
    id: ResourceIdSchema,
    expectedVersion: ExpectedVersionSchema,
    value,
  });
const deleteOperation = z.strictObject({
  operation: z.literal("DELETE"),
  id: ResourceIdSchema,
  expectedVersion: ExpectedVersionSchema,
});

export const CreatePlanSchema = z
  .strictObject({
    title: humanText(200),
    startDate: z.string().regex(DATE_PATTERN).optional(),
    endDate: z.string().regex(DATE_PATTERN).optional(),
    budgetAmount: z.string().regex(MONEY_PATTERN).optional(),
    budgetCurrency: z.string().regex(CURRENCY_PATTERN).optional(),
    notes: humanText(10_000).optional(),
    items: z.array(PlanItemInputSchema).max(500).optional(),
    reservations: z.array(ReservationInputSchema).max(100).optional(),
    checklistItems: z.array(ChecklistInputSchema).max(500).optional(),
  })
  .superRefine(validatePlanShape);

export const UpdatePlanSchema = z
  .strictObject({
    expectedVersion: ExpectedVersionSchema,
    title: humanText(200).optional(),
    status: z.enum(PLAN_STATUSES).optional(),
    startDate: z.string().regex(DATE_PATTERN).optional(),
    endDate: z.string().regex(DATE_PATTERN).optional(),
    budgetAmount: z.string().regex(MONEY_PATTERN).optional(),
    budgetCurrency: z.string().regex(CURRENCY_PATTERN).optional(),
    notes: humanText(10_000).optional(),
    itemOperations: z
      .array(
        z.union([
          createOperation(PlanItemInputSchema),
          updateOperation(PlanItemInputSchema),
          deleteOperation,
        ]),
      )
      .max(500)
      .optional(),
    reservationOperations: z
      .array(
        z.union([
          createOperation(ReservationInputSchema),
          updateOperation(ReservationInputSchema),
          deleteOperation,
        ]),
      )
      .max(100)
      .optional(),
    checklistOperations: z
      .array(
        z.union([
          createOperation(ChecklistInputSchema),
          updateOperation(ChecklistInputSchema),
          deleteOperation,
        ]),
      )
      .max(500)
      .optional(),
  })
  .refine((value) => Object.keys(value).length >= 2, {
    message: "At least one change is required.",
  })
  .superRefine(validatePlanShape);

export const ListPlansQuerySchema = z.strictObject({
  cursor: z.string().min(16).max(4096).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(PLAN_STATUSES).optional(),
  startDateFrom: z.string().regex(DATE_PATTERN).optional(),
  startDateTo: z.string().regex(DATE_PATTERN).optional(),
});

function validatePlanShape(
  value: {
    startDate?: string | undefined;
    endDate?: string | undefined;
    budgetAmount?: string | undefined;
    budgetCurrency?: string | undefined;
  },
  context: z.RefinementCtx,
): void {
  if ((value.budgetAmount === undefined) !== (value.budgetCurrency === undefined))
    context.addIssue({
      code: "custom",
      path: ["budgetAmount"],
      message: "Budget amount and currency are required together.",
    });
  if (
    value.startDate !== undefined &&
    value.endDate !== undefined &&
    value.endDate < value.startDate
  )
    context.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "End date cannot precede start date.",
    });
}

export type CreatePlanDto = z.infer<typeof CreatePlanSchema>;
export type UpdatePlanDto = z.infer<typeof UpdatePlanSchema>;
export type ListPlansQuery = z.infer<typeof ListPlansQuerySchema>;
