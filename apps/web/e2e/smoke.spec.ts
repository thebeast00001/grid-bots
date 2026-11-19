import { expect, test } from "@playwright/test";

test("lab renders every critter", async ({ page }) => {
  await page.goto("/lab");
  // 12 shapes + 8 poses + 6 sizes
  await expect(page.locator("svg.crit")).toHaveCount(12 + 8 + 6);
});

test("pages hydrate without mismatches", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /hydrat/i.test(m.text())) problems.push(m.text().slice(0, 300));
  });
  for (const url of ["/lab", "/welcome"]) {
    await page.goto(url);
    await expect(page.locator("svg.crit").first()).toBeVisible();
  }
  // React reports mismatches right after hydrating; give it a beat.
  await page.waitForTimeout(500);
  expect(problems).toEqual([]);
});
