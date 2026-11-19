import { expect, test, type Page } from "@playwright/test";
import { connectMock, makeBot, resetApp } from "./helpers";

test.beforeEach(async ({ request }) => resetApp(request));

const H = { "x-grid": "1" };

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

test("a list made in chat is a live card; ticking it there ticks it everywhere", async ({ page }) => {
  const send = await chat(page, "Packer");
  await send("make me a packing list for goa: sunscreen, swimsuit and charger");
  const card = page.getByTestId("list-card").filter({ hasText: "Packing for goa" });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByRole("checkbox")).toHaveCount(3);
  await card.getByRole("checkbox", { name: "sunscreen" }).click();
  await expect(card.getByRole("checkbox", { name: "sunscreen" })).toBeChecked();

  await send("add hat to packing for goa");
  await expect(page.getByTestId("bot-message").filter({ hasText: "Added hat to Packing for goa." })).toBeVisible({ timeout: 20_000 });
  // The first reply's card shows the list as it is now, not as it was.
  await expect(page.getByTestId("list-card").first().getByRole("checkbox", { name: "hat" })).toBeVisible();

  await page.getByRole("link", { name: "Lists" }).click();
  const tile = page.getByTestId("list-tile").filter({ hasText: "Packing for goa" });
  await expect(tile).toContainText("1 of 4 done");
  await tile.click();
  await page.getByRole("button", { name: "Done (1)" }).click();
  await expect(page.getByRole("checkbox", { name: "sunscreen" })).toBeChecked();
});

test("the Lists tab: make a checklist, add, tick, reorder, rename, share, delete", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/lists");
  await expect(page.getByText("No lists yet")).toBeVisible();
  await page.getByRole("button", { name: "New list" }).click();
  await page.getByLabel("List name").fill("Groceries");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/lists\/lst_/);

  const add = page.getByPlaceholder("Add an item");
  for (const t of ["milk", "eggs", "bread"]) {
    await add.fill(t);
    await add.press("Enter");
    await expect(page.getByRole("checkbox", { name: t })).toBeVisible();
  }
  await page.getByRole("checkbox", { name: "milk" }).click();
  await expect(page.getByRole("button", { name: "Done (1)" })).toBeVisible();
  await expect(page.getByTestId("open-items").getByTestId("item-text")).toHaveText(["eggs", "bread"]);

  // Reorder from the keyboard: bread moves up one.
  await page.getByRole("button", { name: "Move bread", exact: true }).focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByTestId("open-items").getByTestId("item-text")).toHaveText(["bread", "eggs"]);

  await page.getByRole("button", { name: "Rename Groceries" }).click();
  await page.getByLabel("List name").fill("Food");
  await page.getByLabel("List name").press("Enter");
  await expect(page.getByRole("heading", { name: "Food" })).toBeVisible();

  await page.getByRole("button", { name: "Share" }).click();
  // Windows keeps copied text with \r\n line endings.
  await expect.poll(() => page.evaluate(async () => (await navigator.clipboard.readText()).replace(/\r\n/g, "\n"))).toBe("Food\n☐ bread\n☐ eggs\n☑ milk");

  await page.reload();
  await expect(page.getByTestId("open-items").getByTestId("item-text")).toHaveText(["bread", "eggs"]);
  await expect(page.getByRole("button", { name: "Done (1)" })).toBeVisible();

  await page.getByRole("button", { name: "Delete list" }).click();
  await page.getByRole("button", { name: "Delete for good" }).click();
  await expect(page).toHaveURL(/\/lists$/);
  await expect(page.getByText("No lists yet")).toBeVisible();
});

test("habits: tap today and the streak starts", async ({ page }) => {
  const res = await page.request.post("/api/lists", { headers: H, data: { name: "Habits", kind: "habits", items: [{ text: "Run" }] } });
  const { id } = (await res.json()) as { id: string };
  await page.goto(`/lists/${id}`);
  await page.getByRole("checkbox", { name: "Run, today" }).click();
  await expect(page.getByRole("checkbox", { name: "Run, today" })).toBeChecked();
  await expect(page.getByTestId("streak")).toHaveText("1-day streak");
});

test("expenses: logged from chat and totalled on the card", async ({ page }) => {
  const send = await chat(page, "Money");
  await send("I spent 250 on lunch");
  const card = page.getByTestId("list-card").filter({ hasText: "Expenses" });
  await expect(card).toContainText("Lunch", { timeout: 20_000 });
  await expect(card.getByTestId("month-total")).toHaveText("250.00");
});

test("a card whose list was deleted says so", async ({ page }) => {
  const send = await chat(page, "Gone");
  await send("make me a todo list: call mum");
  const card = page.getByTestId("list-card").filter({ hasText: "Todo" });
  await expect(card).toBeVisible({ timeout: 20_000 });
  const { lists } = (await (await page.request.get("/api/lists")).json()) as { lists: { id: string }[] };
  await page.request.delete(`/api/lists/${lists[0].id}`, { headers: H });
  await expect(page.getByTestId("list-card")).toHaveText(/This list was deleted/);
});

test.describe("phone", () => {
  // Reduced motion: pages appear in place instead of sliding in, so measurements are final.
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, reducedMotion: "reduce" });

  test("a huge amount doesn't run into the remove button", async ({ page }) => {
    const res = await page.request.post("/api/lists", { headers: H, data: { name: "Big spend", kind: "expenses", currency: "INR", items: [{ text: "New laptop", amount: 9_999_999_900 }] } });
    await page.goto(`/lists/${((await res.json()) as { id: string }).id}`);
    // The text must fit its box (a fixed-width box can let it spill out past its edge).
    expect(await page.getByTestId("amount").first().evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    const amount = (await page.getByTestId("amount").first().boundingBox())!;
    const remove = (await page.getByRole("button", { name: "Remove New laptop" }).boundingBox())!;
    expect(amount.x + amount.width).toBeLessThanOrEqual(remove.x);
  });

  test("habit days are labelled on a phone too", async ({ page }) => {
    const res = await page.request.post("/api/lists", { headers: H, data: { name: "Habits", kind: "habits", items: [{ text: "Run" }] } });
    await page.goto(`/lists/${((await res.json()) as { id: string }).id}`);
    await expect(page.getByTestId("habit-days")).toBeVisible();
  });

  test("a card that grows once its list loads keeps the chat scrolled to the bottom", async ({ page }) => {
    const send = await chat(page, "Scroller");
    for (const [t, reply] of [
      ["make me a packing list for goa: sunscreen, swimsuit and charger", "Done — your"],
      ["track my habits: stretch, journal", "Tracking 2 habits."],
      ["I spent 250 on lunch", "Logged Lunch"],
    ]) {
      await send(t);
      await expect(page.getByTestId("bot-message").filter({ hasText: reply })).toBeVisible({ timeout: 20_000 });
    }
    // Opening the chat again: it scrolls to the bottom first, then the cards load (slowly) and grow.
    await page.route("**/api/lists/lst_*", async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      await route.continue();
    });
    await page.reload();
    await expect(page.getByTestId("list-card").last().getByTestId("month-total")).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(500);
    expect(await page.getByTestId("chat-scroller").evaluate((el) => Math.round(el.scrollHeight - el.scrollTop - el.clientHeight))).toBeLessThanOrEqual(2);
  });

  test("a long list name doesn't push the Lists page wider than the screen", async ({ page }) => {
    await page.request.post("/api/lists", { headers: H, data: { name: "Goa trip — packing for the long weekend with the whole family and the dog", kind: "checklist" } });
    await page.goto("/lists");
    const tile = page.getByTestId("list-tile").first();
    await expect(tile).toBeVisible();
    const box = (await tile.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(375);
  });
});
