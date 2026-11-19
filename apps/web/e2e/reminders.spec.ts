import { expect, test } from "@playwright/test";
import { connectMock, makeBot, resetApp } from "./helpers";

test.beforeEach(async ({ request }) => resetApp(request));

const H = { "x-grid": "1" };

test("a reminder set in chat goes off live, snoozes and can be cancelled from the profile", async ({ page }) => {
  await connectMock(page);
  const id = await makeBot(page, "Remy", { skipInterview: true });
  await page.goto(`/bots/${id}`);

  const box = page.getByPlaceholder("Message Remy");
  await box.fill("remind me in 4 seconds to stretch");
  await box.press("Enter");

  const set = page.getByTestId("reminder-set").filter({ hasText: "stretch" });
  await expect(set).toBeVisible();
  await expect(set).toContainText(/Today|Tomorrow/);
  await expect(page.getByTestId("bot-message").filter({ hasText: "Done — I'll remind you" })).toBeVisible();

  // It arrives on its own, without a reload.
  const due = page.getByTestId("reminder-due").filter({ hasText: "stretch" });
  await expect(due).toBeVisible({ timeout: 20_000 });
  await due.getByRole("button", { name: "Snooze" }).click();
  await page.getByRole("menuitem", { name: "10 minutes" }).click();
  await expect(due).toContainText("Snoozed until");

  await page.getByRole("button", { name: "Profile" }).click();
  const profile = page.getByRole("complementary", { name: "Remy's profile" });
  const row = profile.getByTestId("reminder-row").filter({ hasText: "stretch" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Cancel reminder" }).click();
  await expect(profile.getByTestId("reminder-row")).toHaveCount(0);
  await expect(set).toContainText("Cancelled");

  // The snoozed state survives a reload.
  await page.reload();
  await expect(page.getByTestId("reminder-due").filter({ hasText: "stretch" })).toContainText("Snoozed until");
});

test("add, change and cancel a reminder from the profile", async ({ page }) => {
  await connectMock(page);
  const id = await makeBot(page, "Planner", { skipInterview: true });
  await page.goto(`/bots/${id}`);
  await page.getByRole("button", { name: "Profile" }).click();
  const profile = page.getByRole("complementary", { name: "Planner's profile" });

  await profile.getByRole("button", { name: "Add a reminder" }).click();
  await profile.getByLabel("What").fill("Water the plants");
  await profile.getByLabel("When").fill("tomorrow 8am");
  await expect(profile.getByTestId("when-preview")).toHaveText("Tomorrow, 8:00 AM");
  await profile.getByLabel("When").fill("purple");
  await expect(profile.getByTestId("when-preview")).toHaveText(/couldn't tell when/i);
  await profile.getByLabel("When").fill("every day at 7am");
  await expect(profile.getByTestId("when-preview")).toContainText("Every day at 7:00 AM");
  await profile.getByRole("button", { name: "Add", exact: true }).click();

  const row = profile.getByTestId("reminder-row").filter({ hasText: "Water the plants" });
  await expect(row).toContainText("Every day at 7:00 AM");

  await row.getByRole("button", { name: "Change reminder" }).click();
  await profile.getByLabel("When").fill("tomorrow 7pm");
  await profile.getByRole("button", { name: "Save", exact: true }).click();
  await expect(row).toContainText("Tomorrow, 7:00 PM");

  await row.getByRole("button", { name: "Cancel reminder" }).click();
  await expect(profile.getByTestId("reminder-row")).toHaveCount(0);
  await expect(profile.getByText(/No reminders yet/)).toBeVisible();
});

test("a reminder for another bot shows an unread dot and a toast that opens it", async ({ page }) => {
  await connectMock(page);
  const here = await makeBot(page, "Here", { skipInterview: true });
  const there = await makeBot(page, "There", { skipInterview: true });
  await page.goto(`/bots/${here}`);
  await expect(page.getByPlaceholder("Message Here")).toBeVisible();

  const res = await page.request.post("/api/reminders", { headers: H, data: { botId: there, text: "Ping from There", when: "in 3 seconds" } });
  expect(res.status()).toBe(201);

  // Sonner toasts carry data-sonner-toast (no ARIA role of their own).
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Ping from There" });
  await expect(toast).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: /There/ }).getByTestId("unread")).toBeVisible();
  await expect(page).toHaveTitle(/^\(1\) /);

  await toast.getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL(new RegExp(`/bots/${there}$`));
  await expect(page.getByTestId("reminder-due").filter({ hasText: "Ping from There" })).toBeVisible();
  await expect(page.getByRole("link", { name: /There/ }).getByTestId("unread")).toHaveCount(0);
  await expect(page).not.toHaveTitle(/^\(\d+\) /);
});
