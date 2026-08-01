const { readFile } = require("node:fs/promises");
const path = require("node:path");
describe("Planning OpenAPI contract", () => {
  it("contains only approved routes and authoritative operation arrays", async () => {
    const document = JSON.parse(
      await readFile(
        path.resolve(__dirname, "../../openapi/planning-service.openapi.json"),
        "utf8",
      ),
    );
    expect(Object.keys(document.paths).sort()).toEqual(["/plans", "/plans/{id}"]);
    expect(Object.keys(document.paths["/plans"]).sort()).toEqual(["get", "parameters", "post"]);
    expect(document.paths["/plans/{id}"].patch).toBeDefined();
    expect(document.paths["/plans/{id}"].delete).toBeDefined();
    const update = document.components.schemas.UpdatePlanRequest.properties;
    expect(update.itemOperations).toBeDefined();
    expect(update.reservationOperations).toBeDefined();
    expect(update.checklistOperations).toBeDefined();
    expect(document.components.schemas.PlanItemInput.required).toContain("position");
    expect(document.components.schemas.ChecklistItemInput.required).toContain("position");
  });
});
