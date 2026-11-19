import { readFileSync } from "node:fs";
import path from "node:path";
import { createBot } from "../bots/repo";
import { resetDbForTests } from "../db/client";
import { useTempHome } from "../test-home";
import { addMemory, deleteMemory, listMemories, searchMemories, updateMemory } from "./repo";

const home = useTempHome();
afterAll(() => resetDbForTests());

const avatar = { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" } as const;

test("deleting a memory rewrites MEMORY.md without it", async () => {
  const bot = await createBot({ name: "Mem", job: "", avatar });
  const keep = await addMemory({ botId: bot.id, text: "Prefers mornings", source: "bot" });
  const gone = await addMemory({ botId: bot.id, text: "Hates Mondays", source: "you" });
  const file = path.join(home, "bots", bot.handle, "MEMORY.md");
  expect(readFileSync(file, "utf8")).toContain("Hates Mondays");
  await deleteMemory(gone.id);
  const md = readFileSync(file, "utf8");
  expect(md).not.toContain("Hates Mondays");
  expect(md).toContain(keep.text);
});

test("shared memories go to USER.md", async () => {
  await addMemory({ botId: null, text: "Lives in Delhi", source: "you" });
  expect(readFileSync(path.join(home, "USER.md"), "utf8")).toContain("Lives in Delhi");
});

test("search finds memories case-insensitively and treats % literally", async () => {
  await addMemory({ botId: null, text: "Drinks Masala Chai", source: "you" });
  await addMemory({ botId: null, text: "100% vegetarian", source: "you" });
  expect((await searchMemories(null, "masala")).map((m) => m.text)).toEqual(["Drinks Masala Chai"]);
  expect((await searchMemories(null, "%")).map((m) => m.text)).toEqual(["100% vegetarian"]);
});

test("a memory can be added already pinned (undo restores pins)", async () => {
  const m = await addMemory({ botId: null, text: "restored pin", source: "you", pinned: true });
  expect(m.pinned).toBe(true);
});

test("pinning floats a memory to the top; empty text is refused", async () => {
  const a = await addMemory({ botId: null, text: "zzz first", source: "you" });
  await addMemory({ botId: null, text: "zzz second", source: "you" });
  await updateMemory(a.id, { pinned: true });
  expect((await listMemories(null))[0].id).toBe(a.id);
  await expect(updateMemory(a.id, { text: "   " })).rejects.toMatchObject({ status: 400 });
});
