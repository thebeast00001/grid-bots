import { expect, test, type Locator } from "@playwright/test";
import { connectMock, makeBot, resetApp } from "./helpers";

test.beforeEach(async ({ request }) => resetApp(request));

const style = (l: Locator, prop: "outlineStyle" | "boxShadow") => l.evaluate((el, p) => getComputedStyle(el)[p], prop);

test("text fields show focus as one ring on their box, buttons keep the outline", async ({ page }) => {
  await connectMock(page);
  const id = await makeBot(page, "Ring", { skipInterview: true });
  await page.goto(`/bots/${id}`);

  const box = page.getByPlaceholder("Message Ring");
  const pill = page.getByTestId("composer-box");
  const resting = await style(pill, "boxShadow");
  await box.focus();
  expect(await style(box, "outlineStyle")).toBe("none");
  await expect.poll(() => style(pill, "boxShadow")).not.toBe(resting);

  const search = page.getByRole("textbox", { name: "Search bots" });
  await search.focus();
  expect(await style(search, "outlineStyle")).toBe("none");
  const searchBox = search.locator("xpath=..");
  expect(await style(searchBox, "boxShadow")).toContain("1.5px");

  const profile = page.getByRole("button", { name: "Profile" });
  await profile.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  expect(await style(profile, "outlineStyle")).toBe("solid");
});
