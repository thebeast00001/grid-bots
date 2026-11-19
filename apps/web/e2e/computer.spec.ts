import { expect, test } from "@playwright/test";
import { connectMock, makeBot, resetApp } from "./helpers";

test.beforeEach(async ({ request }) => resetApp(request));
test.use({ viewport: { width: 1500, height: 900 } });

test("the bot's screen shows its work live, then its desktop; it opens large and closes with Escape", async ({ page }) => {
  await page.request.patch("/api/web", { headers: { "x-grid": "1" }, data: { service: { kind: "test" } } });
  await connectMock(page);
  const id = await makeBot(page, "Worker", { skipInterview: true });
  await page.goto(`/bots/${id}`);
  const screen = page.getByTestId("screen");
  await expect(screen).toContainText("Idle");

  const box = page.getByPlaceholder("Message Worker");
  await box.fill("deep dive into pune cafes");
  await box.press("Enter");
  // The slow fixture page keeps it reading for a moment.
  await expect(screen).toContainText("grid.test", { timeout: 20_000 });
  await expect(page.getByTestId("bot-message").filter({ hasText: "Deep dive on pune cafes" })).toBeVisible({ timeout: 20_000 });
  await expect(screen).toContainText("Idle");
  await expect(screen).toContainText("Searched 3 times");

  await screen.click();
  const large = page.getByRole("dialog", { name: "Worker's screen" });
  await expect(large).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(large).toHaveCount(0);
});
