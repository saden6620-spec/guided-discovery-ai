export const PLAN_STATUSES = ["DRAFT", "ACCEPTED", "COMPLETED", "CANCELLED"] as const;
export const ITEM_STATUSES = ["PLANNED", "COMPLETED", "CANCELLED"] as const;
export const RESERVATION_STATUSES = ["PLANNED", "CONFIRMED", "CANCELLED"] as const;
export const CHECKLIST_STATUSES = ["PENDING", "COMPLETE"] as const;

export type PlanStatus = (typeof PLAN_STATUSES)[number];
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];
export type ChecklistStatus = (typeof CHECKLIST_STATUSES)[number];

export interface PlanItem {
  readonly id: string;
  readonly title: string;
  readonly startsAt: Date | null;
  readonly endsAt: Date | null;
  readonly locationReference: string | null;
  readonly notes: string | null;
  readonly status: ItemStatus;
  readonly position: number;
  readonly version: number;
}

export interface Reservation {
  readonly id: string;
  readonly providerName: string;
  readonly reference: string | null;
  readonly startsAt: Date | null;
  readonly endsAt: Date | null;
  readonly status: ReservationStatus;
  readonly version: number;
}

export interface ChecklistItem {
  readonly id: string;
  readonly title: string;
  readonly status: ChecklistStatus;
  readonly position: number;
  readonly version: number;
}

export interface PlanRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly status: PlanStatus;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly budgetAmount: string | null;
  readonly budgetCurrency: string | null;
  readonly notes: string | null;
  readonly items: readonly PlanItem[];
  readonly reservations: readonly Reservation[];
  readonly checklistItems: readonly ChecklistItem[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface Principal {
  readonly id: string;
  readonly kind: "USER" | "SERVICE";
  readonly scopes: ReadonlySet<string>;
}
