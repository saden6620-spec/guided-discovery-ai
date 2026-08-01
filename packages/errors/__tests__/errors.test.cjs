describe("error framework", () => {
  it("maps validation errors to the approved envelope", async () => {
    const { ValidationException, toHttpError } = await import("../dist/index.js");
    const result = toHttpError(
      new ValidationException([{ field: "/name", code: "TOO_SMALL", message: "Required" }]),
      "request-1",
    );
    expect(result.status).toBe(422);
    expect(result.body).toMatchObject({
      success: false,
      error: { code: "VALIDATION_FAILED", requestId: "request-1" },
    });
  });

  it("does not expose unknown exception details", async () => {
    const { toHttpError } = await import("../dist/index.js");
    expect(toHttpError(new Error("secret"), "request-2").body.error.message).not.toContain(
      "secret",
    );
  });
});
