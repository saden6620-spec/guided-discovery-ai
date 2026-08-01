const { readFile } = require("node:fs/promises");
const path = require("node:path");
const YAML = require("yaml");
describe("Navigation contracts", () => {
  it("contains only approved public routes, states, and events", async () => {
    const document = JSON.parse(
      await readFile(
        path.resolve(__dirname, "../../openapi/navigation-service.openapi.json"),
        "utf8",
      ),
    );
    expect(Object.keys(document.paths).sort()).toEqual([
      "/navigation/reroute",
      "/navigation/start",
      "/navigation/status",
      "/navigation/stop",
    ]);
    expect(document.components.schemas.NavigationResource.properties.sessionState.enum).toEqual([
      "ACTIVE",
      "COMPLETED",
      "CANCELLED",
    ]);
    const asyncApi = YAML.parse(
      await readFile(path.resolve(__dirname, "../../../../docs/api/m2/asyncapi.yaml"), "utf8"),
    );
    for (const event of [
      "TripStarted",
      "NavigationRerouted",
      "NavigationStopped",
      "TripCompleted",
      "TripCancelled",
    ])
      expect(asyncApi.components.messages[event]).toBeDefined();
  });
  it("limits internal provisioning to destinations and routes", async () => {
    const source = YAML.parse(
      await readFile(
        path.resolve(__dirname, "../../../../docs/api/m2/internal-openapi.yaml"),
        "utf8",
      ),
    );
    const navigation = Object.keys(source.paths).filter(
      (value) =>
        value.startsWith("/destinations") ||
        value.startsWith("/routes") ||
        value.includes("landmarks") ||
        value.includes("navigation-sessions") ||
        value.includes("trips"),
    );
    expect(navigation.sort()).toEqual(["/destinations/{destinationId}", "/routes/{routeId}"]);
  });
});
