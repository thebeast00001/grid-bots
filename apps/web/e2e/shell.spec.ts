import { expect, test } from "@playwright/test";
import { connectMock, makeBot, resetApp } from "./helpers";

test.beforeEach(async ({ request }) => resetApp(request));

test("the sidebar carries the app's places; there's no separate rail", async ({ page }) => {
  await connectMock(page);
  const id = await makeBot(page, "Navi", { skipInterview: true });
  await page.goto(`/bots/${id}`);
  const side = page.getByRole("complementary", { name: "Bots" });
  await expect(side.getByRole("link", { name: "Lists" })).toBeVisible();
  await expect(side.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(side.getByRole("button", { name: /^Notifications/ })).toBeVisible();
  await expect(side.getByRole("button", { name: "Toggle theme" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Home" })).toHaveCount(0);
});

test("a compact chat header with the bot's live status; nothing masks the thread", async ({ page }) => {
  await connectMock(page);
  const id = await makeBot(page, "Header", { skipInterview: true });
  await page.goto(`/bots/${id}`);
  const header = page.getByTestId("chat-header");
  await expect(header).toContainText("Header");
  await expect(header).toContainText("Helps out");
  expect(await page.getByTestId("chat-scroller").evaluate((el) => getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage)).toBe("none");
  const box = page.getByPlaceholder("Message Header");
  await box.fill("hello there");
  await box.press("Enter");
  await expect(page.getByTestId("bot-message").filter({ hasText: "You said: hello there" })).toBeVisible({ timeout: 20_000 });
});

test("the Computer button opens and closes the bot's computer; Profile still opens the profile", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 }); // below the width where it opens by itself
  await connectMock(page);
  const id = await makeBot(page, "Pane", { skipInterview: true });
  await page.goto(`/bots/${id}`);
  const computer = page.getByRole("complementary", { name: "Pane's computer" });
  await expect(computer).toHaveCount(0);
  await page.getByRole("button", { name: "Computer", exact: true }).click();
  await expect(computer).toBeVisible();
  await page.getByRole("button", { name: "Profile" }).click();
  await expect(page.getByRole("complementary", { name: "Pane's profile" })).toBeVisible();
  await expect(computer).toHaveCount(0);
  await page.getByRole("button", { name: "Computer", exact: true }).click();
  await page.getByRole("button", { name: "Computer", exact: true }).click();
  await expect(computer).toHaveCount(0);
});

test("on a wide screen the computer is open from the start", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await connectMock(page);
  const id = await makeBot(page, "Wide", { skipInterview: true });
  await page.goto(`/bots/${id}`);
  await expect(page.getByRole("complementary", { name: "Wide's computer" })).toBeVisible();
});
