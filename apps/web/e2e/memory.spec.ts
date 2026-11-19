import { expect, test } from "@playwright/test";
import { connectMock, makeBot, resetApp } from "./helpers";

test.beforeEach(async ({ request }) => resetApp(request));

test("remember via chat, see it, delete it, undo", async ({ page }) => {
  await connectMock(page);
  const id = await makeBot(page, "Memo", { skipInterview: true });
  await page.goto(`/bots/${id}`);
  const box = page.getByPlaceholder("Message Memo");
  await box.fill("remember I like tea");
  await box.press("Enter");
  await expect(page.getByTestId("bot-message").filter({ hasText: "Got it." })).toBeVisible();

  await page.getByRole("button", { name: "Profile" }).click();
  const profile = page.getByRole("complementary", { name: "Memo's profile" });
  const row = profile.getByTestId("memory").filter({ hasText: "I like tea" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("I noticed");

  await row.getByRole("button", { name: "Delete memory" }).click();
  await expect(profile.getByTestId("memory").filter({ hasText: "I like tea" })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(profile.getByTestId("memory").filter({ hasText: "I like tea" })).toBeVisible();
});

test("remember a message from the toolbar and add one by hand", async ({ page }) => {
  await connectMock(page);
  const id = await makeBot(page, "Keeper", { skipInterview: true });
  await page.goto(`/bots/${id}`);
  const box = page.getByPlaceholder("Message Keeper");
  await box.fill("My sister is Priya");
  await box.press("Enter");
  await expect(page.getByTestId("bot-message").filter({ hasText: "You said" })).toBeVisible();
  const mine = page.getByTestId("user-message").last();
  await mine.hover();
  await mine.getByRole("button", { name: "Remember this" }).click();
  await expect(page.getByText("Saved to what Keeper knows about you")).toBeVisible();

  await page.getByRole("button", { name: "Profile" }).click();
  const profile = page.getByRole("complementary", { name: "Keeper's profile" });
  await expect(profile.getByTestId("memory").filter({ hasText: "My sister is Priya" })).toContainText("You told me");

  await profile.getByRole("tab", { name: "Keeper's notes" }).click();
  await profile.getByPlaceholder("Add a note").fill("Brief me at 8");
  await profile.getByPlaceholder("Add a note").press("Enter");
  await expect(profile.getByTestId("memory").filter({ hasText: "Brief me at 8" })).toBeVisible();
});
