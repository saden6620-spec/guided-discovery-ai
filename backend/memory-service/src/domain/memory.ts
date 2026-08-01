export const MEMORY_STATES = ["ACTIVE", "ARCHIVED", "DELETED_PENDING_PURGE"] as const;
export const PUBLIC_MEMORY_STATES = ["ACTIVE", "ARCHIVED"] as const;
export const MEMORY_SENSITIVITIES = ["STANDARD", "SENSITIVE", "HIGHLY_SENSITIVE"] as const;
export const VERIFICATION_STATUSES = [
  "UNVERIFIED",
  "USER_CONFIRMED",
  "SOURCE_VERIFIED",
  "CORRECTED",
] as const;
export const RELATIONSHIP_TYPES = [
  "RELATED_TO",
  "SUPERSEDES",
  "SUPPORTS",
  "CONTRADICTS",
  "PART_OF",
] as const;
export const SYMMETRIC_RELATIONSHIPS = new Set(["RELATED_TO", "CONTRADICTS"]);

export type MemoryState = (typeof MEMORY_STATES)[number];
export type PublicMemoryState = (typeof PUBLIC_MEMORY_STATES)[number];
export type MemorySensitivity = (typeof MEMORY_SENSITIVITIES)[number];
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export interface MemoryCategory {
  readonly id: string;
  readonly key: string;
  readonly displayName: string;
  readonly defaultSensitivity: MemorySensitivity;
  readonly version: number;
}

export interface MemoryLink {
  readonly id: string;
  readonly sourceMemoryId: string;
  readonly targetMemoryId: string;
  readonly relationshipType: RelationshipType;
  readonly createdAt: Date;
  readonly version: number;
}

export interface MemoryRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly category: MemoryCategory;
  readonly currentVersionId: string;
  readonly state: PublicMemoryState;
  readonly importance: number;
  readonly sensitivity: MemorySensitivity;
  readonly verificationStatus: VerificationStatus;
  readonly permissionPolicyRef: string;
  readonly permissionPolicyVersion: number;
  readonly retentionPolicyRef: "U0_ACTIVE";
  readonly userConfirmedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
  readonly titleCiphertext: Buffer;
  readonly summaryCiphertext: Buffer;
  readonly purposeCiphertext: Buffer;
  readonly sourceType: "USER_EXPLICIT" | "USER_CONFIRMED" | "IMPORT" | "SERVICE_EVENT";
  readonly sourceRefCiphertext: Buffer | null;
  readonly originatedAt: Date | null;
  readonly confidence: number;
  readonly encryptionState: "ENCRYPTED";
  readonly links: readonly MemoryLink[];
}

export interface MemoryView {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly category: Pick<MemoryCategory, "id" | "key" | "displayName">;
  readonly importance: number;
  readonly state: PublicMemoryState;
  readonly sensitivity: MemorySensitivity;
  readonly verificationStatus: VerificationStatus;
  readonly purpose: string;
  readonly sourceType: MemoryRecord["sourceType"];
  readonly sourceRef: string | null;
  readonly originatedAt: string | null;
  readonly confidence: number;
  readonly userConfirmedAt: string | null;
  readonly links: readonly {
    readonly id: string;
    readonly sourceMemoryId: string;
    readonly targetMemoryId: string;
    readonly relationshipType: RelationshipType;
    readonly createdAt: string;
    readonly version: number;
  }[];
  readonly visibility: "PRIVATE";
  readonly retentionPolicyRef: "U0_ACTIVE";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface Principal {
  readonly id: string;
  readonly kind: "USER" | "SERVICE";
  readonly scopes: ReadonlySet<string>;
}
