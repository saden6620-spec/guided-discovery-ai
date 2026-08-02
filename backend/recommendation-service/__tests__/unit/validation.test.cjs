describe("Recommendation validation", () => {
  let schemas;
  beforeAll(async () => {
    schemas = await import("../../dist/presentation/schemas.js");
  });
  it("accepts only unique approved score factors", () => {
    const base = {
      ownerId: "123e4567-e89b-42d3-a456-426614174000",
      category: "TRAVEL",
      title: "Title",
      summary: "Summary",
      rationale: "Rationale",
      confidence: 0.8,
      availableAt: "2026-08-01T00:00:00.000Z",
      permissionPolicyRef: "recommendation.owner.v1",
      permissionVersion: 1,
      provenance: { producer: "fixture-producer", sourceType: "TEST_FIXTURE", sourceVersion: 1 },
      scores: [
        { factor: "SAFETY", score: 0.9 },
        { factor: "ACCESSIBILITY", score: 0.7 },
      ],
    };
    expect(schemas.CreateRecommendationSchema.safeParse(base).success).toBe(true);
    expect(
      schemas.CreateRecommendationSchema.safeParse({
        ...base,
        scores: [base.scores[0], base.scores[0]],
      }).success,
    ).toBe(false);
    expect(
      schemas.CreateRecommendationSchema.safeParse({ ...base, safetyAttributes: { level: "HIGH" } })
        .success,
    ).toBe(false);
  });
});
