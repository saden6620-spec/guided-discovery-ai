export type EntryType = "TEXT" | "VOICE_REFERENCE" | "PHOTO_REFERENCE" | "VIDEO_REFERENCE";
export type MediaKind = "VOICE" | "PHOTO" | "VIDEO";
export interface Principal {
  id: string;
  kind: "USER" | "SERVICE";
  scopes: ReadonlySet<string>;
}
export interface JournalEntry {
  id: string;
  type: EntryType;
  content: string | null;
  mediaReferenceId: string | null;
  occurredAt: Date;
  locationReference: string | null;
  position: number;
  version: number;
}
export interface Reflection {
  id: string;
  entryId: string | null;
  text: string;
  occurredAt: Date;
  position: number;
  version: number;
}
export interface MediaReference {
  id: string;
  mediaId: string;
  mediaKind: MediaKind;
  caption: string | null;
  position: number;
  version: number;
}
export interface JournalRecord {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  tripId: string | null;
  permissionPolicyRef: string;
  permissionPolicyVersion: number;
  startedAt: Date | null;
  endedAt: Date | null;
  entries: readonly JournalEntry[];
  reflections: readonly Reflection[];
  media: readonly MediaReference[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}
