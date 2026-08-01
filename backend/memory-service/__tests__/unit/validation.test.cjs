describe("memory request validation", () => {
  it("rejects unknown fields and invalid corrections", async () => {
    const { CreateMemorySchema, UpdateMemorySchema } =
      await import("../../dist/presentation/schemas.js");
    expect(
      CreateMemorySchema.safeParse({
        title: "A",
        summary: "B",
        purpose: "C",
        categoryId: "98c7bc59-e1d0-5fef-a7b0-8928588f8ddf",
        sensitivity: "STANDARD",
        unknown: true,
      }).success,
    ).toBe(false);
    expect(
      UpdateMemorySchema.safeParse({ expectedVersion: 1, correctionReason: "Incorrect" }).success,
    ).toBe(false);
    expect(UpdateMemorySchema.safeParse({ expectedVersion: 1 }).success).toBe(false);
  });
});
