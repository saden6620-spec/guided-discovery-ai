const { readFile } = require("node:fs/promises");
const path = require("node:path");

describe("Memory Service OpenAPI contract", () => {
  it("contains every approved route and does not require rationale", async () => {
    const document = JSON.parse(
      await readFile(path.resolve(__dirname, "../../openapi/memory-service.openapi.json"), "utf8"),
    );
    expect(Object.keys(document.paths).sort()).toEqual(["/memories", "/memories/{id}"]);
    expect(document.paths["/memories"].get).toBeDefined();
    expect(document.paths["/memories"].post).toBeDefined();
    expect(document.paths["/memories/{id}"].get).toBeDefined();
    expect(document.paths["/memories/{id}"].patch).toBeDefined();
    expect(document.paths["/memories/{id}"].delete).toBeDefined();
    expect(document.components.schemas.MemoryResource.required).not.toContain("rationale");
  });
});
