import { expect, test } from "@playwright/test";
import { connectMock, makeBot, resetApp } from "./helpers";

test.beforeEach(async ({ request }) => resetApp(request));

test("make a bot in the Studio", async ({ page }) => {
  await connectMock(page);
  await page.goto("/new");
  await page.getByRole("button", { name: "Cube" }).click();
  await page.getByPlaceholder("Name your bot").fill("Maya");
  await page.getByPlaceholder("What should it take care of?").fill("Runs my week");
  await page.getByRole("button", { name: "Bring to life" }).click();
  await expect(page).toHaveURL(/\/bots\/bot_/);
  await expect(page.getByRole("link", { name: /Maya/ }).first()).toBeVisible();
});

test("home sends returning users to their latest bot", async ({ page }) => {
  await connectMock(page);
  const id = await makeBot(page, "Pip");
  await page.goto("/");
  await expect(page).toHaveURL(new RegExp(`/bots/${id}$`));
});
