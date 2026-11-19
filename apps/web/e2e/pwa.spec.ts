import { expect, test } from "@playwright/test";
import { connectMock, makeBot, resetApp } from "./helpers";

test.beforeEach(async ({ request }) => resetApp(request));

test("manifest is served and valid", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m).toMatchObject({ name: "Grid", short_name: "Grid", start_url: "/", display: "standalone" });
  expect(m.icons).toHaveLength(3);
  for (const icon of m.icons) expect((await request.get(icon.src)).ok()).toBe(true);
});

test("service worker and offline page are served", async ({ request }) => {
  const sw = await request.get("/sw.js");
  expect(sw.ok()).toBe(true);
  expect(sw.headers()["content-type"]).toContain("javascript");
  expect(await sw.text()).toContain('GRID_SW = "m1-2"');
  const offline = await request.get("/offline");
  expect(offline.ok()).toBe(true);
  expect(await offline.text()).toContain("You're offline");
});

test.describe("phone", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test("list → chat → back, profile in a sheet", async ({ page }) => {
    await connectMock(page);
    const id = await makeBot(page, "Pocket", { skipInterview: true });

    await page.goto(`/bots/${id}`);
    await expect(page.getByPlaceholder("Message Pocket")).toBeVisible();
    // The desktop sidebar is hidden on phones.
    await expect(page.getByRole("textbox", { name: "Search bots" })).toBeHidden();

    await page.getByRole("link", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/bots$/);
    // One "New bot" button on the list screen (the header's), not two.
    await expect(page.getByRole("link", { name: "New bot" })).toHaveCount(1);
    await page.getByRole("link", { name: /Pocket/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/bots/${id}$`));

    await page.getByRole("button", { name: "Profile" }).click();
    const sheet = page.getByRole("dialog", { name: "Pocket's profile" });
    await expect(sheet.getByRole("heading", { name: "Soul" })).toBeVisible();
    await sheet.getByRole("button", { name: "Close profile" }).click();
    await expect(sheet).toBeHidden();
  });
});
