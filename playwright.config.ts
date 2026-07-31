import { defineConfig } from "@playwright/test";

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  testDir: "./tests/end-to-end",
  use: {
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
  },
});
