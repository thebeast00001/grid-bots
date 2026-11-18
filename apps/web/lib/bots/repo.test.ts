import { existsSync } from "node:fs";
import path from "node:path";
import { getDb, resetDbForTests } from "../db/client";
import { messages } from "../db/schema";
import type { CritterConfig } from "../critter/types";
import { useTempHome } from "../test-home";
import { createBot, deleteBot, getBot, listBots, uniqueHandle, updateBot } from "./repo";

const home = useTempHome();
afterAll(() => resetDbForTests());

const avatar: CritterConfig = { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" };

test("uniqueHandle slugs and de-duplicates", () => {
  expect(uniqueHandle("Maya", [])).toBe("maya");
  expect(uniqueHandle("Maya", ["maya"])).toBe("maya-2");
  expect(uniqueHandle("Maya", ["maya", "maya-2"])).toBe("maya-3");
  expect(uniqueHandle("✨🤖", [])).toBe("bot");
  expect(uniqueHandle("Ünïcode Name That Is Long", [])).toBe("unicodenamethati");
});

test("createBot rejects a blank name", async () => {
  await expect(createBot({ name: "  ", job: "", avatar })).rejects.toThrow();
});

test("createBot trims, picks a unique handle and starts the interview", async () => {
  const a = await createBot({ name: " Maya ", job: "Runs my week", avatar });
  const b = await createBot({ name: "Maya", job: "", avatar });
  expect(a).toMatchObject({ name: "Maya", handle: "maya", interview: "pending", instructions: [], model: null });
  expect(b.handle).toBe("maya-2");
  expect(await getBot(a.id)).toMatchObject({ id: a.id, job: "Runs my week" });
});

test("listBots puts the most recently updated first", async () => {
  const first = await createBot({ name: "First", job: "", avatar });
  await createBot({ name: "Second", job: "", avatar });
  await updateBot(first.id, { job: "touched" });
  expect((await listBots())[0].id).toBe(first.id);
});

test("deleteBot removes the bot, its messages and its folder", async () => {
  const bot = await createBot({ name: "Gone", job: "", avatar });
  const db = await getDb();
  await db.insert(messages).values({ id: "m1", botId: bot.id, role: "user", parts: [{ type: "text", text: "hi" }] });
  const folder = path.join(home, "bots", bot.handle);
  expect(existsSync(folder)).toBe(true);
  await deleteBot(bot.id);
  expect(await getBot(bot.id)).toBeNull();
  expect(await db.select().from(messages)).toEqual([]);
  expect(existsSync(folder)).toBe(false);
});
