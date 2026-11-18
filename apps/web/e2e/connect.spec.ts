import { expect, test } from "@playwright/test";
import { connectMock, resetApp } from "./helpers";

test.beforeEach(async ({ request }) => resetApp(request));

test("first run: connect the test model and land in the Studio", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole("button", { name: "Continue with ChatGPT" })).toBeVisible();
  await page.getByRole("button", { name: "Paste an API key" }).click();
  await page.getByLabel("Provider").selectOption("mock");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page).toHaveURL(/\/new/);
});

test("a refused key shows an inline error", async ({ page }) => {
  await page.goto("/welcome");
  await page.getByRole("button", { name: "Paste an API key" }).click();
  await page.getByLabel("Provider").selectOption("anthropic");
  await expect(page.getByText("Claude subscriptions can't be used in third-party apps. Use an API key instead.")).toBeVisible();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  // Next's route announcer is also role=alert, so match ours by text.
  await expect(page.getByRole("alert").filter({ hasText: "Paste your Anthropic (Claude) API key." })).toBeVisible();
});

test("settings lists providers without showing keys", async ({ page }) => {
  await connectMock(page);
  await page.goto("/settings/models");
  await expect(page.getByText("Test model").first()).toBeVisible();
  await expect(page.getByLabel("Default model")).toHaveValue(/mock-chat/);
  for (const input of await page.locator("input").all()) expect(await input.inputValue()).toBe("");
});

test("ChatGPT connection shows the plan modal once", async ({ page }) => {
  await connectMock(page);
  await page.goto("/settings/models?chatgpt=connected");
  const dialog = page.getByRole("dialog", { name: "You're using your ChatGPT plan" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Got it" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
