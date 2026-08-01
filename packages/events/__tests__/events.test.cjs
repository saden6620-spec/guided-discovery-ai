describe("event abstractions", () => {
  it("round-trips a canonical event envelope", async () => {
    const { JsonEventSerializer, isCompatibleEventVersion } = await import("../dist/index.js");
    const event = {
      eventId: "123e4567-e89b-42d3-a456-426614174000",
      eventType: "TestRecorded",
      eventVersion: 1,
      occurredAt: "2026-08-01T00:00:00.000Z",
      producer: "test-service",
      subjectType: "TEST",
      subjectId: "123e4567-e89b-42d3-a456-426614174001",
      subjectVersion: 1,
      correlationId: "correlation-1",
      payload: { value: true },
    };
    const serializer = new JsonEventSerializer();
    expect(serializer.deserialize(serializer.serialize(event))).toEqual(event);
    expect(isCompatibleEventVersion(1, 1)).toBe(true);
    expect(isCompatibleEventVersion(1, 2)).toBe(false);
  });
});
