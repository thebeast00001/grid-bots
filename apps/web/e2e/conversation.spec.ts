import { expect, test } from "@playwright/test";
import { connectMock, makeBot, resetApp } from "./helpers";

test.beforeEach(async ({ request }) => resetApp(request));

const bg = (el: Element) => getComputedStyle(el).backgroundColor;

test("replies read as plain text, your messages as bubbles, with a time over the thread", async ({ page }) => {
  await connectMock(page);
  const id = await makeBot(page, "Talker", { skipInterview: true });
  await page.goto(`/bots/${id}`);
  const box = page.getByPlaceholder("Message Talker");
  await box.fill("hello there");
  await box.press("Enter");
  await expect(page.getByTestId("bot-message").filter({ hasText: "You said: hello there" })).toBeVisible({ timeout: 20_000 });
  await page.reload();
  const reply = page.getByTestId("bot-message").filter({ hasText: "You said: hello there" }).getByTestId("message-text");
  const mine = page.getByTestId("user-message").getByTestId("message-text");
  expect(await reply.evaluate(bg)).toBe("rgba(0, 0, 0, 0)");
  expect(await mine.evaluate(bg)).not.toBe("rgba(0, 0, 0, 0)");
  await expect(page.getByTestId("time-break").first()).toHaveText(/\d{1,2}:\d{2}/);
});

test("the message box grows to about 8 lines, then scrolls; Shift+Enter breaks a line, Enter sends", async ({ page }) => {
  await connectMock(page);
  const id = await makeBot(page, "Typist", { skipInterview: true });
  await page.goto(`/bots/${id}`);
  const box = page.getByPlaceholder("Message Typist");
  await box.click();
  for (let i = 1; i <= 12; i++) {
    await page.keyboard.type(`line ${i}`);
    if (i < 12) await page.keyboard.press("Shift+Enter");
  }
  const size = await box.evaluate((el) => ({ h: el.clientHeight, sh: el.scrollHeight }));
  expect(size.h).toBeGreaterThan(150);
  expect(size.h).toBeLessThanOrEqual(220);
  expect(size.sh).toBeGreaterThan(size.h);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("bot-message").filter({ hasText: "line 12" })).toBeVisible({ timeout: 20_000 });
  await expect(box).toHaveValue("");
});
