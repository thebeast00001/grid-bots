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
