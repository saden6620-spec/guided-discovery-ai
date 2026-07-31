import { expect, test } from "@playwright/test";

test("Playwright can exercise an isolated browser page", async ({ page }) => {
  await page.setContent("<main><h1>Repository Foundation</h1></main>");

  await expect(page.getByRole("heading", { name: "Repository Foundation" })).toBeVisible();
});
