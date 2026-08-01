describe("validation framework", () => {
  it("validates pagination and applies the safe default", async () => {
    const { validatePagination } = await import("../dist/index.js");
    expect(validatePagination({})).toEqual({ limit: 25 });
    expect(validatePagination({ limit: "100" })).toEqual({ limit: 100 });
  });

  it("emits field-level validation errors", async () => {
    const { validatePagination } = await import("../dist/index.js");
    expect(() => validatePagination({ limit: 101 })).toThrow("One or more fields are invalid");
  });
});
