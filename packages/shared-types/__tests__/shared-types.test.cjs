describe("shared types", () => {
  it("has a loadable type-only public module", async () => {
    const module = await import("../dist/index.js");
    expect(Object.keys(module)).toEqual([]);
  });
});
