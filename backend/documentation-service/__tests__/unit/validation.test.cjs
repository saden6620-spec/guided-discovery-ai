const { describe, expect, test } = require("@jest/globals");
describe("Documentation validation", () => {
  test("POST accepts text entries and rejects media fields", async () => {
    const { CreateJournalSchema } = await import("../../dist/presentation/schemas.js");
    expect(
      CreateJournalSchema.safeParse({
        title: "Journey",
        entries: [
          { type: "TEXT", content: "Day one", occurredAt: "2026-08-05T10:00:00.000Z", position: 0 },
        ],
      }).success,
    ).toBe(true);
    expect(
      CreateJournalSchema.safeParse({
        title: "Journey",
        entries: [
          {
            type: "PHOTO_REFERENCE",
            mediaReferenceId: crypto.randomUUID(),
            occurredAt: "2026-08-05T10:00:00.000Z",
            position: 0,
          },
        ],
      }).success,
    ).toBe(false);
  });
  test("PATCH enforces content/media exclusivity", async () => {
    const { UpdateJournalSchema } = await import("../../dist/presentation/schemas.js");
    expect(
      UpdateJournalSchema.safeParse({
        expectedVersion: 1,
        entryOperations: [
          {
            operation: "CREATE",
            clientReference: "entry-1",
            value: {
              type: "PHOTO_REFERENCE",
              mediaReferenceClientReference: "photo-1",
              occurredAt: "2026-08-05T10:00:00.000Z",
              position: 0,
            },
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      UpdateJournalSchema.safeParse({
        expectedVersion: 1,
        entryOperations: [
          {
            operation: "CREATE",
            clientReference: "entry-1",
            value: {
              type: "TEXT",
              content: "x",
              mediaReferenceId: crypto.randomUUID(),
              occurredAt: "2026-08-05T10:00:00.000Z",
              position: 0,
            },
          },
        ],
      }).success,
    ).toBe(false);
  });
});
