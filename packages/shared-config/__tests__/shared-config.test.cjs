describe("shared configuration", () => {
  it("loads immutable validated defaults", async () => {
    const { loadConfiguration } = await import("../dist/index.js");
    const configuration = loadConfiguration({
      serviceName: "test-service",
      serviceVersion: "1.0.0",
      defaultPort: 3000,
      environment: { APP_ENV: "test" },
    });
    expect(configuration).toMatchObject({
      environment: "test",
      serviceName: "test-service",
      port: 3000,
    });
    expect(Object.isFrozen(configuration)).toBe(true);
  });

  it("rejects invalid startup configuration", async () => {
    const { loadConfiguration } = await import("../dist/index.js");
    expect(() =>
      loadConfiguration({
        serviceName: "test-service",
        serviceVersion: "1.0.0",
        defaultPort: 3000,
        environment: { APP_ENV: "production", PORT: "0" },
      }),
    ).toThrow();
  });
});
