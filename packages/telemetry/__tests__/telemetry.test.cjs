describe("telemetry abstractions", () => {
  it("records a single non-negative timing", async () => {
    const { Timing } = await import("../dist/index.js");
    const values = [];
    const times = [1000, 1250];
    const timing = new Timing({ record: (value) => values.push(value) }, {}, () => times.shift());
    expect(timing.stop()).toBe(0.25);
    expect(values).toEqual([0.25]);
    expect(() => timing.stop()).toThrow("already been stopped");
  });
});
