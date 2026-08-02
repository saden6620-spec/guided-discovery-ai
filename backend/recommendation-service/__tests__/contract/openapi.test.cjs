const { readFile } = require("node:fs/promises"),
  path = require("node:path"),
  YAML = require("yaml");
describe("Recommendation contracts", () => {
  it("contains only approved public routes and lifecycle events", async () => {
    const document = JSON.parse(
      await readFile(
        path.resolve(__dirname, "../../openapi/recommendation-service.openapi.json"),
        "utf8",
      ),
    );
    expect(Object.keys(document.paths).sort()).toEqual([
      "/recommendations",
      "/recommendations/{id}/accept",
      "/recommendations/{id}/dismiss",
    ]);
    const asyncApi = YAML.parse(
      await readFile(path.resolve(__dirname, "../../../../docs/api/m2/asyncapi.yaml"), "utf8"),
    );
    expect(Object.keys(asyncApi.channels.recommendationChanged.messages).sort()).toEqual([
      "RecommendationAccepted",
      "RecommendationDismissed",
      "RecommendationExpired",
    ]);
  });
  it("requires server-resolved permission fields and no structured safety metadata", async () => {
    const internal = YAML.parse(
        await readFile(
          path.resolve(__dirname, "../../../../docs/api/m2/internal-openapi.yaml"),
          "utf8",
        ),
      ),
      schema = internal.components.schemas.CreateRecommendationCommand;
    expect(schema.required).toEqual(
      expect.arrayContaining(["permissionPolicyRef", "permissionVersion"]),
    );
    expect(schema.properties.permissionPolicyRef.maxLength).toBe(128);
    expect(schema.properties.safetyAttributes).toBeUndefined();
    expect(schema.properties.accessibilityAttributes).toBeUndefined();
  });
});
