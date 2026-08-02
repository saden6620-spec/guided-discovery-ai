export const recommendationStatuses = [
  "AVAILABLE",
  "ACCEPTED",
  "REJECTED",
  "DISMISSED",
  "IGNORED",
  "EXPIRED",
] as const;
export type RecommendationStatus = (typeof recommendationStatuses)[number];
export const scoreFactors = [
  "SAFETY",
  "EDUCATIONAL_VALUE",
  "RELEVANCE",
  "USER_INTEREST",
  "TIMING",
  "ACCESSIBILITY",
  "CONFIDENCE",
  "URGENCY",
] as const;
export type ScoreFactor = (typeof scoreFactors)[number];
export interface Principal {
  id: string;
  kind: "USER" | "SERVICE";
  scopes: ReadonlySet<string>;
}
export interface Score {
  factor: ScoreFactor;
  score: number;
}
export interface Provenance {
  producer: string;
  sourceType: "USER_ACTION" | "SERVICE_EVENT" | "IMPORT" | "TEST_FIXTURE";
  sourceResourceId: string | null;
  sourceVersion: number;
}
export interface RecommendationRecord {
  id: string;
  ownerId: string;
  category: string;
  title: string;
  summary: string;
  rationale: string;
  status: RecommendationStatus;
  confidence: number;
  availableAt: Date;
  expiresAt: Date | null;
  permissionPolicyRef: string;
  permissionVersion: number;
  provenance: Provenance;
  scores: readonly Score[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  purgeAfter: Date | null;
  version: number;
}
export interface RecommendationResource {
  id: string;
  category: string;
  title: string;
  summary: string;
  rationale: string;
  status: RecommendationStatus;
  confidence: number;
  availableAt: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}
export function toResource(value: RecommendationRecord): RecommendationResource {
  return {
    id: value.id,
    category: value.category,
    title: value.title,
    summary: value.summary,
    rationale: value.rationale,
    status: value.status,
    confidence: value.confidence,
    availableAt: value.availableAt.toISOString(),
    expiresAt: value.expiresAt?.toISOString() ?? null,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
    version: value.version,
  };
}
