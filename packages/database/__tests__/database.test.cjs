describe("database abstractions", () => {
  it("remain interface-only at runtime", async () => {
    const module = await import("../dist/index.js");
    expect(Object.keys(module)).toEqual([]);
  });
});
