import { expect, test, type Page } from "@playwright/test";
import { connectMock, makeBot, resetApp } from "./helpers";

test.beforeEach(async ({ request }) => resetApp(request));

const H = { "x-grid": "1" };
const toastWith = (page: Page, text: string) => page.locator("[data-sonner-toast]").filter({ hasText: text });
const inbox = (page: Page) => page.getByRole("dialog", { name: "Notifications" });

test("a reminder lands in the inbox, survives a reload, and opening its chat clears it", async ({ page }) => {
  await connectMock(page);
  const here = await makeBot(page, "Here", { skipInterview: true });
  const there = await makeBot(page, "There", { skipInterview: true });
  await page.goto(`/bots/${here}`);
  await expect(page.getByPlaceholder("Message Here")).toBeVisible();

  await page.request.post("/api/reminders", { headers: H, data: { botId: there, text: "Ping from There", when: "in 2 seconds" } });
  await expect(toastWith(page, "Ping from There")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("inbox-count")).toHaveText("1");

  await page.reload();
  await expect(page.getByTestId("inbox-count")).toHaveText("1");
  await expect(page.getByRole("link", { name: /There/ }).getByTestId("unread")).toBeVisible();
  await expect(page).toHaveTitle(/^\(1\) /);

  await page.getByRole("button", { name: /^Notifications/ }).click();
  const item = inbox(page).getByTestId("inbox-item").filter({ hasText: "Ping from There" });
  await expect(item).toContainText("There");
  await item.click();
  await expect(page).toHaveURL(new RegExp(`/bots/${there}$`));
  await expect(page.getByTestId("inbox-count")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /There/ }).getByTestId("unread")).toHaveCount(0);
});

test("a muted bot's reminder waits quietly in the inbox", async ({ page }) => {
  await connectMock(page);
  const here = await makeBot(page, "Loud", { skipInterview: true });
  const shh = await makeBot(page, "Shh", { skipInterview: true });
  await page.goto(`/bots/${shh}`);
  await page.getByRole("button", { name: "Profile" }).click();
  const profile = page.getByRole("complementary", { name: "Shh's profile" });
  await profile.getByRole("button", { name: "Mute notifications" }).click();
  await page.getByRole("menuitem", { name: "1 hour" }).click();
  await expect(profile).toContainText(/Muted until/);

  await page.goto(`/bots/${here}`);
  await page.request.post("/api/reminders", { headers: H, data: { botId: shh, text: "Hushed reminder", when: "in 2 seconds" } });
  await page.getByRole("button", { name: /^Notifications/ }).click();
  const item = inbox(page).getByTestId("inbox-item").filter({ hasText: "Hushed reminder" });
  await expect(item).toBeVisible({ timeout: 20_000 });
  await expect(item).toContainText("Muted");
  await expect(toastWith(page, "Hushed reminder")).toHaveCount(0);
});

test("a three-digit unread count grows away from the bell instead of covering it", async ({ page }) => {
  await connectMock(page);
  const here = await makeBot(page, "Reader", { skipInterview: true });
  const busy = await makeBot(page, "Busy", { skipInterview: true });
  await page.request.patch(`/api/bots/${busy}`, { headers: H, data: { mute: "1h" } }); // no toast storm
  for (let i = 0; i < 100; i++) await page.request.post("/api/reminders", { headers: H, data: { botId: busy, text: `Bulk ${i}`, when: "in 1 second" } });
  await page.goto(`/bots/${here}`);
  const button = page.getByRole("button", { name: /^Notifications/ });
  await expect(button.getByTestId("inbox-count")).toHaveText("99+", { timeout: 20_000 });
  const bell = (await button.locator("svg").boundingBox())!;
  const badge = (await button.getByTestId("inbox-count").boundingBox())!;
  expect(badge.x).toBeGreaterThanOrEqual(bell.x + bell.width / 2);
});

test("quiet hours hold a routine result; 'Only what matters' holds an ordinary one", async ({ page }) => {
  await connectMock(page);
  const here = await makeBot(page, "Desk", { skipInterview: true });
  const worker = await makeBot(page, "Worker", { skipInterview: true });
  const res = await page.request.post("/api/routines", { headers: H, data: { botId: worker, name: "Daily digest", instruction: "Write my digest", when: "every day at 9am" } });
  const routine = (await res.json()) as { id: string };

  // Quiet hours around now, set in the settings page.
  await page.goto("/settings/notifications");
  const now = await page.evaluate(() => {
    const d = new Date();
    const hhmm = (x: Date) => `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
    return { from: hhmm(new Date(d.getTime() - 3_600_000)), to: hhmm(new Date(d.getTime() + 3_600_000)) };
  });
  await page.getByRole("switch", { name: "Quiet hours" }).click();
  await page.getByLabel("From").fill(now.from);
  await page.getByLabel("To").fill(now.to);
  await page.getByLabel("To").blur();
  await expect.poll(async () => (await (await page.request.get("/api/settings")).json()).quietHours).toEqual(now);

  await page.goto(`/bots/${here}`);
  await page.request.post(`/api/routines/${routine.id}/run`, { headers: H });
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await expect(inbox(page).getByTestId("inbox-item").filter({ hasText: "Daily digest" }).first()).toContainText("Quiet hours", { timeout: 20_000 });
  await expect(toastWith(page, "Daily digest")).toHaveCount(0);

  // Quiet hours off, only what matters.
  await page.goto("/settings/notifications");
  await page.getByRole("switch", { name: "Quiet hours" }).click();
  await page.getByRole("radio", { name: /Only what matters/ }).click();
  await expect.poll(async () => (await (await page.request.get("/api/settings")).json()).pingFor).toBe("important");
  await page.goto(`/bots/${here}`);
  await page.request.post(`/api/routines/${routine.id}/run`, { headers: H });
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await expect(inbox(page).getByTestId("inbox-item").filter({ hasText: "Not important" })).toHaveCount(1, { timeout: 20_000 });
  await expect(toastWith(page, "Daily digest")).toHaveCount(0);
});
