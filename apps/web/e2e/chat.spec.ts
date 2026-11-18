import { expect, test } from "@playwright/test";
import { connectMock, makeBot, resetApp } from "./helpers";

test.beforeEach(async ({ request }) => resetApp(request));

// 1×1 transparent PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

test("send, stream, react, edit, regenerate", async ({ page }) => {
  await connectMock(page);
  const id = await makeBot(page, "Echo", { skipInterview: true });
  await page.goto(`/bots/${id}`);

  const box = page.getByPlaceholder("Message Echo");
  await box.fill("hi");
  await box.press("Enter");
  await expect(page.getByTestId("bot-message").filter({ hasText: "You said: hi" })).toBeVisible();
  await expect(page.getByText(/^Read/)).toBeVisible();

  const reply = page.getByTestId("bot-message").last();
  await reply.hover();
  // Wait for the save so the reload doesn't cancel it mid-flight.
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/messages/") && r.ok()),
    reply.getByRole("button", { name: "React ❤️" }).click(),
  ]);
  await expect(reply.getByTestId("reaction")).toHaveText("❤️");
  await page.reload();
  await expect(page.getByTestId("bot-message").last().getByTestId("reaction")).toHaveText("❤️");

  const mine = page.getByTestId("user-message").last();
  await mine.hover();
  await mine.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Edit message").fill("yo");
  await page.getByRole("button", { name: "Save" }).click();
  const thread = page.getByTestId("bot-message");
  await expect(thread.filter({ hasText: "You said: yo" })).toBeVisible();
  await expect(thread.filter({ hasText: "You said: hi" })).toHaveCount(0);

  const last = page.getByTestId("bot-message").last();
  await last.hover();
  await last.getByRole("button", { name: "Regenerate" }).click();
  await expect(page.getByTestId("bot-message").filter({ hasText: "You said: yo" })).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId("bot-message")).toHaveCount(1);
});

test("attach an image", async ({ page }) => {
  await connectMock(page);
  const id = await makeBot(page, "Eyes", { skipInterview: true });
  await page.goto(`/bots/${id}`);
  await page.getByLabel("Attach a file").setInputFiles({ name: "pic.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("pic.png")).toBeVisible();
  const box = page.getByPlaceholder("Message Eyes");
  await box.fill("look");
  await box.press("Enter");
  await expect(page.getByTestId("user-message").getByAltText("pic.png")).toBeVisible();
  await expect(page.getByTestId("bot-message").filter({ hasText: "You said: look" })).toBeVisible();
});

test("no model shows an actionable error", async ({ page }) => {
  await connectMock(page);
  const id = await makeBot(page, "Lost", { skipInterview: true });
  const { providers } = await (await page.request.get("/api/providers")).json();
  for (const p of providers) await page.request.delete(`/api/providers/${p.id}`, { headers: { "x-grid": "1" } });
  await page.goto(`/bots/${id}`);
  const box = page.getByPlaceholder("Message Lost");
  await box.fill("hi");
  await box.press("Enter");
  await expect(page.getByRole("link", { name: "Connect a model", exact: true })).toBeVisible();
});

test("pin a message as a standing instruction", async ({ page }) => {
  await connectMock(page);
  const id = await makeBot(page, "Pinny", { skipInterview: true });
  await page.goto(`/bots/${id}`);
  const box = page.getByPlaceholder("Message Pinny");
  await box.fill("Always reply in one line");
  await box.press("Enter");
  await expect(page.getByTestId("bot-message").filter({ hasText: "You said: Always reply in one line" })).toBeVisible();
  const mine = page.getByTestId("user-message").last();
  await mine.hover();
  await mine.getByRole("button", { name: "Pin as instruction" }).click();
  await expect(page.getByText("Pinned as a standing instruction")).toBeVisible();
  const bot = await (await page.request.get(`/api/bots/${id}`)).json();
  expect(bot.instructions).toEqual(["Always reply in one line"]);
});
