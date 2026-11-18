import { useTempHome } from "../test-home";
import { getDb, resetDbForTests } from "./client";
import { bots, settings } from "./schema";

useTempHome();

afterAll(() => resetDbForTests());

test("database opens, migrates and survives reopen", async () => {
  const db = await getDb();
  await db.insert(settings).values({ key: "a", value: 1 });
  await resetDbForTests();
  const db2 = await getDb();
  expect((await db2.select().from(settings)).length).toBe(1);
});

test("bot handles are unique", async () => {
  const db = await getDb();
  const bot = {
    name: "Maya",
    handle: "maya",
    job: "",
    avatar: { shape: "orb", color: 0, eyes: "dot", acc: "none", material: "flat" } as const,
  };
  await db.insert(bots).values({ id: "b1", ...bot });
  await expect(db.insert(bots).values({ id: "b2", ...bot })).rejects.toThrow();
});
