import { expect, test } from "@playwright/test";
import { resetApp } from "./helpers";

// The default headless shell reports every notification permission as denied; full Chromium doesn't.
test.use({ channel: "chromium", permissions: ["notifications"] });
test.beforeEach(async ({ request }) => resetApp(request));

test("a browser that can't push says so instead of offering the same button again", async ({ page }) => {
  await page.goto("/settings/notifications");
  const device = page.getByRole("region", { name: "On this device" });
  await expect(device).toContainText("while a Grid tab is open");
  await expect(device.getByRole("button", { name: "Turn on notifications" })).toHaveCount(0);
  // The e2e server is a dev build, which registers no service worker, so this can't work.
  await device.getByRole("button", { name: "Also when Grid is closed" }).click();
  await expect(device).toContainText("couldn't set up notifications for when Grid is closed");
  await expect(device.getByRole("button")).toHaveCount(0);
});
