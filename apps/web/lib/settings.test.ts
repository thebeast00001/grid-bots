import { resetDbForTests } from "./db/client";
import { getSetting, hostId, setSetting } from "./settings";
import { useTempHome } from "./test-home";

useTempHome();

afterAll(() => resetDbForTests());

test("settings round-trip and overwrite", async () => {
  expect(await getSetting("theme")).toBeUndefined();
  await setSetting("theme", { mode: "dark" });
  await setSetting("theme", { mode: "light" });
  expect(await getSetting("theme")).toEqual({ mode: "light" });
});

test("hostId is stable", async () => {
  const id = await hostId();
  expect(id).toMatch(/^urn:uuid:[0-9a-f-]{36}$/);
  expect(await hostId()).toBe(id);
});
