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

test.describe("dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("a chat page opened directly hydrates without mismatches", async ({ page, request }) => {
    await request.post("/api/test/reset", { headers: { "x-grid": "1" } });
    const problems: string[] = [];
    page.on("pageerror", (e) => /hydrat/i.test(e.message) && problems.push(e.message.slice(0, 200)));
    page.on("console", (m) => m.type() === "error" && /hydrat/i.test(m.text()) && problems.push(m.text().slice(0, 200)));
    const res = await request.post("/api/bots", {
      headers: { "x-grid": "1" },
      data: { name: "Night", job: "", avatar: { shape: "orb", color: 2, eyes: "dot", acc: "none", material: "clay" } },
    });
    const { id } = (await res.json()) as { id: string };
    await page.goto(`/bots/${id}`);
    await expect(page.getByRole("button", { name: "Toggle theme" })).toBeVisible();
    await page.waitForTimeout(800);
    expect(problems).toEqual([]);
  });
});
