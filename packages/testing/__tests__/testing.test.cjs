describe("testing utilities", () => {
  it("creates and asserts shared contract fixtures", async () => {
    const { assertDomainEvent, assertHealth, assertPageMetadata, createEvent, createMockHealth } =
      await import("../dist/index.js");
    assertHealth(createMockHealth(), "UP");
    assertPageMetadata({ nextCursor: null, hasMore: false, limit: 25 }, 25);
    assertDomainEvent(createEvent("TestRecorded", { value: true }), "TestRecorded");
  });
});
