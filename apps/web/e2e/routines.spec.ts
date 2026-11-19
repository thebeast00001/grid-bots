import { expect, test, type Page } from "@playwright/test";
import { connectMock, makeBot, resetApp } from "./helpers";

test.beforeEach(async ({ request }) => resetApp(request));

const H = { "x-grid": "1" };
const profileOf = (page: Page, name: string) => page.getByRole("complementary", { name: `${name}'s profile` });

test("ask for a routine in chat, run it now, see the result arrive live", async ({ page }) => {
  await connectMock(page);
  const id = await makeBot(page, "Brief", { skipInterview: true });
  await page.goto(`/bots/${id}`);

  const box = page.getByPlaceholder("Message Brief");
  await box.fill("every weekday at 8am give me a briefing");
  await box.press("Enter");

  const card = page.getByTestId("routine-set").filter({ hasText: "Give me a briefing" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Weekdays at 8:00 AM");
  await expect(card).toContainText(/Next .*8:00 AM/);
  // The instruction isn't repeated when it says the same as the name.
  await expect(card.getByText("give me a briefing", { exact: true })).toHaveCount(0);

  await card.getByRole("button", { name: "Run now" }).click();
  const result = page.getByTestId("routine-result").filter({ hasText: "Give me a briefing" });
  await expect(result).toBeVisible();
  await expect(page.getByTestId("bot-message").filter({ hasText: "Routine result: give me a briefing" })).toBeVisible();

  // The run shows in the routine's history.
  await page.getByRole("button", { name: "Profile" }).click();
  const row = profileOf(page, "Brief").getByTestId("routine-row").filter({ hasText: "Give me a briefing" });
  await row.getByRole("button", { name: "History" }).click();
  await expect(row.getByTestId("run")).toHaveCount(1);
  await expect(row.getByTestId("run").first()).toContainText(/Ran by hand.*Done/);
});

test("add from a preset, pause, resume, change and delete in the profile", async ({ page }) => {
  await connectMock(page);
  const id = await makeBot(page, "Coach", { skipInterview: true });
  await page.goto(`/bots/${id}`);
  await page.getByRole("button", { name: "Profile" }).click();
  const profile = profileOf(page, "Coach");

  await profile.getByRole("button", { name: "Morning briefing" }).click();
  await expect(profile.getByLabel("Name")).toHaveValue("Morning briefing");
  await expect(profile.getByTestId("schedule-preview")).toContainText("Weekdays at 8:00 AM");
  await profile.getByRole("button", { name: "Add", exact: true }).click();

  const row = profile.getByTestId("routine-row").filter({ hasText: "Morning briefing" });
  await expect(row).toContainText("Weekdays at 8:00 AM");
  await expect(row).toContainText(/Next /);

  const toggle = row.getByRole("switch", { name: "Morning briefing is on" });
  await toggle.click();
  await expect(row).toContainText("Paused");
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(row).toContainText(/Next /);

  await row.getByRole("button", { name: "Change routine" }).click();
  await profile.getByLabel("When").fill("every day at 7am");
  await expect(profile.getByTestId("schedule-preview")).toContainText("Every day at 7:00 AM");
  await profile.getByRole("button", { name: "Save", exact: true }).click();
  await expect(row).toContainText("Every day at 7:00 AM");

  await row.getByRole("button", { name: "Delete routine" }).click();
  await row.getByRole("button", { name: "Yes, delete" }).click();
  await expect(profile.getByTestId("routine-row")).toHaveCount(0);
});

test("a routine without a model says why it couldn't run", async ({ page }) => {
  const id = await makeBot(page, "Unplugged", { skipInterview: true });
  const res = await page.request.post("/api/routines", {
    headers: H,
    data: { botId: id, name: "Evening check-in", instruction: "Ask how my day went", when: "every day at 9pm" },
  });
  expect(res.status()).toBe(201);
  await page.goto(`/bots/${id}`);
  await page.getByRole("button", { name: "Profile" }).click();
  await profileOf(page, "Unplugged").getByTestId("routine-row").getByRole("button", { name: "Run now" }).click();

  const failed = page.getByTestId("routine-result").filter({ hasText: "Evening check-in" });
  await expect(failed).toContainText("couldn't run");
  await expect(failed).toContainText("Connect a model to start chatting.");
  await expect(failed.getByRole("link", { name: "Connect a model" })).toBeVisible();
});
