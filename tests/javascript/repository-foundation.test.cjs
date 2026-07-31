const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "../..");

describe("repository foundation", () => {
  it("declares the approved top-level directories", () => {
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

  it.each([
    ["backend", "api-gateway"],
    ["backend", "auth-service"],
    ["backend", "user-service"],
    ["backend", "permission-service"],
    ["backend", "memory-service"],
    ["backend", "navigation-service"],
    ["backend", "recommendation-service"],
    ["backend", "learning-service"],
    ["backend", "documentation-service"],
    ["backend", "translation-service"],
    ["backend", "community-service"],
    ["backend", "notification-service"],
    ["backend", "media-service"],
    ["backend", "analytics-service"],
    ["backend", "search-service"],
    ["backend", "planning-service"],
    ["ai", "orchestrator"],
    ["ai", "conversation"],
    ["ai", "planning"],
    ["ai", "reasoning"],
    ["ai", "memory"],
    ["ai", "recommendation"],
    ["ai", "navigation"],
    ["ai", "vision"],
    ["ai", "speech"],
    ["ai", "translation"],
    ["ai", "safety"],
    ["ai", "accessibility"],
    ["ai", "personalization"],
    ["ai", "learning"],
    ["ai", "documentation"],
    ["ai", "evaluation"],
    ["packages", "ui"],
    ["packages", "design-system"],
    ["packages", "shared-types"],
    ["packages", "shared-config"],
    ["packages", "utilities"],
    ["packages", "logging"],
    ["packages", "permissions"],
    ["packages", "authentication"],
    ["packages", "localization"],
    ["packages", "maps"],
    ["packages", "telemetry"],
    ["packages", "testing"],
    ["infrastructure", "terraform"],
    ["infrastructure", "kubernetes"],
    ["infrastructure", "docker"],
    ["infrastructure", "monitoring"],
    ["infrastructure", "networking"],
    ["infrastructure", "secrets"],
    ["infrastructure", "databases"],
    ["infrastructure", "backups"],
    ["infrastructure", "cloud"],
  ])("contains the documented %s/%s boundary", (group, name) => {
    expect(fs.statSync(path.join(repositoryRoot, group, name)).isDirectory()).toBe(true);
  });
});
