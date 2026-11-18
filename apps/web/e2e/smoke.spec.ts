import { expect, test } from "@playwright/test";

test("lab renders every critter", async ({ page }) => {
  await page.goto("/lab");
  // 12 shapes + 8 poses + 6 sizes
  await expect(page.locator("svg.crit")).toHaveCount(12 + 8 + 6);
});
