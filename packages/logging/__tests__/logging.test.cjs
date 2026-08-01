describe("structured logging", () => {
  it("adds context and redacts sensitive attributes", async () => {
    const { StructuredLogger } = await import("../dist/index.js");
    const records = [];
    const logger = new StructuredLogger(
      "test-service",
      { write: (record) => records.push(record) },
      undefined,
      () => new Date(0),
    );
    logger.info("request.completed", { token: "secret", status: 200 });
    expect(records[0]).toMatchObject({
      service: "test-service",
      severity: "info",
      attributes: { token: "[REDACTED]", status: 200 },
    });
  });
});
