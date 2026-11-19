import { expect, test, type Page } from "@playwright/test";
import { resetApp } from "./helpers";

test.beforeEach(async ({ request }) => resetApp(request));

/** The whole first-run path through the UI only: welcome → model → Studio → interview → memory. */
async function installToReply(page: Page) {
  const start = Date.now();

  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome/);
  await page.getByRole("button", { name: "Paste an API key" }).click();
  await page.getByLabel("Provider").selectOption("mock");
  await page.getByRole("button", { name: "Connect", exact: true }).click();

  await expect(page).toHaveURL(/\/new/);
  await page.getByRole("button", { name: "Tangerine" }).click();
  await page.getByRole("button", { name: "Cube" }).click();
  await page.getByPlaceholder("Name your bot").fill("Maya");
  await page.getByRole("button", { name: "Bring to life" }).click();
  await expect(page).toHaveURL(/\/bots\/bot_/);

  const replies = page.getByTestId("bot-message");
  await expect(replies.filter({ hasText: "Question 1" })).toBeVisible();
  const box = page.getByPlaceholder("Message Maya");
  for (let i = 1; i <= 5; i++) {
    await box.fill(`answer ${i}`);
    await box.press("Enter");
    if (i < 5) await expect(replies.filter({ hasText: `Question ${i + 1}` })).toBeVisible();
  }
  await expect(page.getByText("Maya wrote their soul")).toBeVisible();

  await box.fill("remember I like tea");
  await box.press("Enter");
  await expect(replies.filter({ hasText: "Got it." })).toBeVisible();

  await page.getByRole("button", { name: "Profile" }).click();
  const profile = page.getByRole("complementary", { name: "Maya's profile" });
  await expect(profile.getByRole("tab", { name: "About you" })).toHaveAttribute("aria-selected", "true");
  await expect(profile.getByTestId("memory").filter({ hasText: "I like tea" })).toBeVisible();

  expect(Date.now() - start).toBeLessThan(120_000);
}

test("install-to-reply in one session", async ({ page }) => {
  test.setTimeout(150_000);
  await installToReply(page);
});

test.describe("phone", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test("install-to-reply in one session", async ({ page }) => {
    test.setTimeout(150_000);
    await installToReply(page);
  });
});
