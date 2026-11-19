import { expect, test } from "@playwright/test";
import { connectMock, makeBot, resetApp } from "./helpers";

test.beforeEach(async ({ request }) => resetApp(request));

test("new bot interviews, writes its soul, shows it in the profile", async ({ page }) => {
  await connectMock(page);
  const id = await makeBot(page, "Testy");
  await page.goto(`/bots/${id}`);

  const replies = page.getByTestId("bot-message");
  await expect(replies.filter({ hasText: "Question 1" })).toBeVisible();
  await expect(page.getByText("Getting to know you · 0/5")).toBeVisible();
  await expect(page.getByText("[[start]]")).toHaveCount(0);

  const box = page.getByPlaceholder("Message Testy");
  for (let i = 1; i <= 5; i++) {
    await box.fill(`answer ${i}`);
    await box.press("Enter");
    if (i < 5) await expect(replies.filter({ hasText: `Question ${i + 1}` })).toBeVisible();
  }

  await expect(page.getByText("Testy wrote their soul")).toBeVisible();
  await page.getByRole("button", { name: "View soul" }).click();
  const profile = page.getByRole("complementary", { name: "Testy's profile" });
  await expect(profile.getByRole("heading", { name: "Personality" })).toBeVisible();

  const bot = await (await page.request.get(`/api/bots/${id}`)).json();
  expect(bot.interview).toBe("done");
});

test("skip writes a starter soul", async ({ page }) => {
  await connectMock(page);
  const id = await makeBot(page, "Skippy");
  await page.goto(`/bots/${id}`);
  await expect(page.getByTestId("bot-message").filter({ hasText: "Question 1" })).toBeVisible();
  await page.getByRole("button", { name: "Skip interview" }).click();
  await expect(page.getByText("Skippy wrote a starter soul")).toBeVisible();
  await page.getByRole("button", { name: "View soul" }).click();
  await expect(page.getByRole("complementary", { name: "Skippy's profile" }).getByRole("heading", { name: "Always ask first" })).toBeVisible();
});

test("profile edits the job and removes a standing instruction", async ({ page }) => {
  await connectMock(page);
  const id = await makeBot(page, "Prof", { skipInterview: true });
  await page.request.patch(`/api/bots/${id}`, { headers: { "x-grid": "1" }, data: { instructions: ["Be brief", "Use metric"] } });
  await page.goto(`/bots/${id}`);
  await page.getByRole("button", { name: "Profile" }).click();
  const profile = page.getByRole("complementary", { name: "Prof's profile" });
  await profile.getByRole("button", { name: "Remove: Be brief" }).click();
  const job = profile.getByLabel("Job");
  await job.fill("Plans my trips");
  await job.blur();
  await expect.poll(async () => (await (await page.request.get(`/api/bots/${id}`)).json()).instructions).toEqual(["Use metric"]);
  await expect.poll(async () => (await (await page.request.get(`/api/bots/${id}`)).json()).job).toBe("Plans my trips");
});
