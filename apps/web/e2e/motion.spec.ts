import { expect, test } from "@playwright/test";
import { connectMock, makeBot, resetApp } from "./helpers";

test.beforeEach(async ({ request }) => resetApp(request));

test.describe("reduced motion", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, reducedMotion: "reduce" });

  test("the profile sheet appears in place instead of sliding up", async ({ page }) => {
    await connectMock(page);
    const id = await makeBot(page, "Still", { skipInterview: true });
    await page.goto(`/bots/${id}`);
    await page.getByRole("button", { name: "Profile" }).click();
    const sheet = page.getByRole("dialog", { name: "Still's profile" });
    await expect(sheet).toBeVisible();
    // Two frames after opening, a sliding sheet would still be far below its resting place.
    const offset = await sheet.evaluate(
      (el) =>
        new Promise<number>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(new DOMMatrix(getComputedStyle(el).transform).m42))),
        ),
    );
    expect(offset).toBe(0);
  });
});
