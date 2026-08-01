describe("Planning validation", () => {
  let schemas;
  beforeAll(async () => {
    schemas = await import("../../dist/presentation/schemas.js");
  });
  it("requires explicit stable positions", () => {
    expect(
      schemas.CreatePlanSchema.safeParse({ title: "Cairo", items: [{ title: "Museum" }] }).success,
    ).toBe(false);
    expect(
      schemas.CreatePlanSchema.safeParse({
        title: "Cairo",
        items: [{ title: "Museum", position: 0 }],
        checklistItems: [{ title: "Passport", position: 0 }],
      }).success,
    ).toBe(true);
  });
  it("enforces budget pairing and date ordering", () => {
    expect(
      schemas.CreatePlanSchema.safeParse({ title: "Cairo", budgetAmount: "10.00" }).success,
    ).toBe(false);
    expect(
      schemas.CreatePlanSchema.safeParse({
        title: "Cairo",
        startDate: "2026-08-10",
        endDate: "2026-08-01",
      }).success,
    ).toBe(false);
  });
  it("rejects empty update commands", () => {
    expect(schemas.UpdatePlanSchema.safeParse({ expectedVersion: 1 }).success).toBe(false);
  });
});
