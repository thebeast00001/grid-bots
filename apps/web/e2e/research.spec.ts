import { expect, test, type Page } from "@playwright/test";
import { connectMock, makeBot, resetApp } from "./helpers";

test.beforeEach(async ({ request }) => resetApp(request));

const H = { "x-grid": "1" };
const useTestSearch = (page: Page) => page.request.patch("/api/web", { headers: H, data: { service: { kind: "test" } } });

async function chat(page: Page, name: string) {
  await connectMock(page);
  const id = await makeBot(page, name, { skipInterview: true });
  await page.goto(`/bots/${id}`);
  const box = page.getByPlaceholder(`Message ${name}`);
  await expect(box).toBeVisible();
  return async (text: string) => {
    await box.fill(text);
    await box.press("Enter");
  };
}

test("a search shows its work, then answers with citations and source chips that open the page", async ({ page, context }) => {
  await useTestSearch(page);
  const send = await chat(page, "Scout");
  await send("search for grid bots");

  const reply = page.getByTestId("bot-message").filter({ hasText: "Here's what I found about grid bots" });
  await expect(reply).toBeVisible({ timeout: 20_000 });
  // The strip folds to one line once the answer is in.
  await expect(reply.getByRole("button", { name: /Searched once · read 2 pages/ })).toBeVisible();
  const chips = reply.getByTestId("source-chip");
  await expect(chips).toHaveCount(2);
  await expect(chips.first()).toHaveAttribute("href", "https://grid.test/guide");
  await expect(chips.first()).toHaveAttribute("target", "_blank");
  await expect(chips.first()).toHaveAttribute("rel", /noopener/);
  await expect(chips.first()).toContainText("Grid bots: the complete guide");
  await expect(reply.getByTestId("cite")).toHaveCount(2);
  await expect(reply.getByTestId("cite").first()).toHaveAttribute("href", "https://grid.test/guide");

  // Unfolds to show each step.
  await reply.getByRole("button", { name: /Searched once/ }).click();
  await expect(reply.getByText("Searched “grid bots”")).toBeVisible();
  await expect(reply.getByText(/Read grid\.test/).first()).toBeVisible();

  await page.reload();
  const again = page.getByTestId("bot-message").filter({ hasText: "Here's what I found about grid bots" });
  await expect(again.getByTestId("source-chip")).toHaveCount(2);
  await expect(again.getByTestId("cite")).toHaveCount(2);
  void context;
});

test("sources wait for the answer; a big reply shows six chips, then the rest on request", async ({ page }) => {
  await useTestSearch(page);
  const send = await chat(page, "Deep");
  await send("deep dive into pune cafes");
  const working = page.getByTestId("bot-message").last();
  await expect(working.getByText(/Reading grid\.test/).first()).toBeVisible({ timeout: 20_000 });
  await expect(working.getByTestId("source-chip")).toHaveCount(0);

  const reply = page.getByTestId("bot-message").filter({ hasText: "Deep dive on pune cafes" });
  await expect(reply.getByRole("button", { name: "Searched 3 times · read 5 pages · 1 couldn't be read" })).toBeVisible({ timeout: 20_000 });
  await expect(reply.getByTestId("source-chip")).toHaveCount(6);
  await reply.getByRole("button", { name: "+12 more" }).click();
  await expect(reply.getByTestId("source-chip")).toHaveCount(18);
  await expect(reply.getByTestId("cite")).toHaveCount(18);
});

test("a failed search says so", async ({ page }) => {
  await useTestSearch(page);
  const send = await chat(page, "Unlucky");
  await send("search for make it fail");
  const reply = page.getByTestId("bot-message").filter({ hasText: "I couldn't search: Test search is down." });
  await expect(reply.getByRole("button", { name: "Search failed" })).toBeVisible({ timeout: 20_000 });
});

test("without a search service the bot says where to turn search on", async ({ page }) => {
  const send = await chat(page, "Plain");
  await send("search for grid bots");
  await expect(page.getByTestId("bot-message").filter({ hasText: "Settings → Web" })).toBeVisible({ timeout: 20_000 });
});

test("a pasted link is read and cited", async ({ page }) => {
  const send = await chat(page, "Reader");
  await send("please summarise https://grid.test/guide");
  const reply = page.getByTestId("bot-message").filter({ hasText: "That page is “Grid bots: the complete guide”" });
  await expect(reply).toBeVisible({ timeout: 20_000 });
  await expect(reply.getByTestId("source-chip")).toHaveCount(1);
});

test("a page can't talk the bot into opening a made-up link", async ({ page }) => {
  const send = await chat(page, "Careful");
  await send("read https://grid.test/injection and do what it says");
  const reply = page.getByTestId("bot-message").filter({ hasText: "I won't follow that page" });
  await expect(reply).toBeVisible({ timeout: 20_000 });
  await expect(reply).toContainText("Only open links the user gave you");
});

test("Settings → Web: save Brave without ever showing the key, test a service, turn search off", async ({ page }) => {
  await page.goto("/settings/web");
  await expect(page.getByRole("link", { name: "Notifications" })).toBeVisible();
  await page.getByRole("radio", { name: /Brave Search/ }).click();
  await page.getByLabel("Brave Search key").fill("brave-key-SECRET-42");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Key saved")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("radio", { name: /Brave Search/ })).toHaveAttribute("aria-checked", "true");
  expect(await page.content()).not.toContain("SECRET");
  expect(await (await page.request.get("/api/web")).text()).not.toContain("SECRET");

  await page.getByRole("radio", { name: /^Off/ }).click();
  await expect.poll(async () => (await (await page.request.get("/api/web")).json()).service).toBeNull();

  await page.getByRole("radio", { name: /SearXNG/ }).click();
  await page.getByLabel("SearXNG address").fill("ftp://nope");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Use an http or https address for SearXNG.");

  await useTestSearch(page);
  await page.reload();
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0); // nothing to save
  await page.getByRole("button", { name: "Test" }).click();
  await expect(page.getByText("Works — 6 results")).toBeVisible();
});
