const fs = require("node:fs");
const path = require("node:path");

describe("repository foundation", () => {
  it("declares the approved top-level directories", () => {
    const repositoryRoot = path.resolve(__dirname, "../..");
    const expectedDirectories = [
      "ai",
      "apps",
      "assets",
      "backend",
      "docs",
      "infrastructure",
      "packages",
      "scripts",
      "tests",
      "tools",
    ];

    for (const directory of expectedDirectories) {
      expect(fs.statSync(path.join(repositoryRoot, directory)).isDirectory()).toBe(true);
    }
  });
});
