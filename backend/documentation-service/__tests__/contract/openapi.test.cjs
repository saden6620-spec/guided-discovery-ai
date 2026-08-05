const { test, expect } = require("@jest/globals");
const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");
test("Documentation public contract has only approved endpoints and media ownership", () => {
  const api = YAML.parse(
    fs.readFileSync(path.resolve(__dirname, "../../../../docs/api/m2/openapi.yaml"), "utf8"),
  );
  expect(Object.keys(api.paths).filter((p) => p.includes("journal"))).toEqual([
    "/journals",
    "/journals/{id}",
  ]);
  const s = api.components.schemas;
  expect(s.CreateJournalRequest.properties.entries.items.$ref).toContain("CreateJournalEntryInput");
  expect(s.CreateJournalEntryInput.properties.type.const).toBe("TEXT");
  expect(s.JournalMediaReference.properties.entryId).toBeUndefined();
  expect(s.MediaReferenceInput.properties.entryId).toBeUndefined();
  expect(s.JournalEntry.properties.mediaReferenceId).toBeDefined();
});
