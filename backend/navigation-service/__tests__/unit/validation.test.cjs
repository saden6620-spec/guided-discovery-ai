describe("Navigation validation and privacy", () => {
  let schemas;
  beforeAll(async () => {
    schemas = await import("../../dist/presentation/schemas.js");
  });
  it("accepts seven-decimal coordinates and rejects invalid ranges", () => {
    const base = {
      provider: "TEST",
      providerReference: "cairo",
      name: "Cairo",
      latitude: 30.04442,
      longitude: 31.235712,
      timezone: "Africa/Cairo",
      accessibility: { wheelchairAccessible: true, stepFree: true },
      sourceVersion: 1,
    };
    expect(schemas.DestinationUpsertSchema.safeParse(base).success).toBe(true);
    expect(schemas.DestinationUpsertSchema.safeParse({ ...base, latitude: 91 }).success).toBe(
      false,
    );
    expect(
      schemas.DestinationUpsertSchema.safeParse({ ...base, longitude: 31.12345678 }).success,
    ).toBe(false);
  });
  it("contains no deferred lifecycle value", () => {
    expect(
      schemas.StopNavigationSchema.safeParse({
        sessionId: "123e4567-e89b-42d3-a456-426614174000",
        outcome: "INVALID",
        expectedVersion: 1,
      }).success,
    ).toBe(false);
  });
});
