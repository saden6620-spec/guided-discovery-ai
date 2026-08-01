describe("health aggregation", () => {
  it("keeps liveness dependency-free and aggregates readiness", async () => {
    const { HealthAggregator } = await import("../dist/index.js");
    let checked = false;
    const health = new HealthAggregator({
      service: "test-service",
      version: "1.0.0",
      checks: [
        {
          name: "database",
          check: async () => {
            checked = true;
            return { status: "UP" };
          },
        },
      ],
      now: () => new Date(0),
    });
    expect(health.liveness().status).toBe("UP");
    expect(checked).toBe(false);
    expect((await health.readiness()).status).toBe("UP");
    expect(checked).toBe(true);
  });
});
