import { readFileSync } from "node:fs";
import path from "node:path";
import type { Memory } from "../db/schema";
import { useTempHome } from "../test-home";
import { mirrorBot, mirrorUser } from "./mirror";
import type { Bot } from "./repo";

const home = useTempHome();

const bot: Bot = {
  id: "b1",
  name: "Maya",
  handle: "maya",
  job: "Runs my week",
  avatar: { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" },
  soul: "",
  interview: "pending",
  model: null,
  instructions: ["Always cc Priya"],
  createdAt: "2026-11-18T00:00:00Z",
  updatedAt: "2026-11-18T00:00:00Z",
};
const mem = (text: string, botId: string | null, pinned = false): Memory => ({
  id: text,
  botId,
  text,
  source: "you",
  sourceMessageId: null,
  pinned,
  createdAt: "2026-11-18T00:00:00Z",
});

test("mirrorBot writes SOUL.md and MEMORY.md under the handle", async () => {
  await mirrorBot(bot, [mem("Likes short replies", "b1", true), mem("Works at Aster", "b1")]);
  const soul = readFileSync(path.join(home, "bots", "maya", "SOUL.md"), "utf8");
  expect(soul).toContain("# Maya");
  expect(soul).toContain("Runs my week");
  expect(soul).toContain("- Always cc Priya");
  const memory = readFileSync(path.join(home, "bots", "maya", "MEMORY.md"), "utf8");
  expect(memory).toContain("- 📌 Likes short replies");
  expect(memory).toContain("- Works at Aster");
});

test("mirrorBot uses the written soul once there is one", async () => {
  await mirrorBot({ ...bot, soul: "# Maya\n\n## Personality\nCalm." }, []);
  expect(readFileSync(path.join(home, "bots", "maya", "SOUL.md"), "utf8")).toContain("## Personality\nCalm.");
});

test("mirrorUser writes USER.md", async () => {
  await mirrorUser([mem("Name is Ansh", null)]);
  expect(readFileSync(path.join(home, "USER.md"), "utf8")).toContain("- Name is Ansh");
});
