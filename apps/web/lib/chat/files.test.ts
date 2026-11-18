import { readFileSync } from "node:fs";
import type { UIMessage } from "ai";
import { createBot } from "../bots/repo";
import { resetDbForTests } from "../db/client";
import { useTempHome } from "../test-home";
import { MAX_FILE_BYTES, inlineFileParts, saveUpload } from "./files";

const home = useTempHome();
afterAll(() => resetDbForTests());

const avatar = { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" } as const;
const png = () => new File([new Uint8Array([137, 80, 78, 71])], "pic.png", { type: "image/png" });

test("saveUpload stores the file and inlineFileParts turns its url into a data url", async () => {
  const b = await createBot({ name: "Files", job: "", avatar });
  const up = await saveUpload(b.id, png());
  expect(up).toMatchObject({ url: `/api/files/${up.id}`, name: "pic.png", mediaType: "image/png" });
  expect(readFileSync(`${home}/files/${up.id}`)).toHaveLength(4);

  const msgs: UIMessage[] = [{ id: "u", role: "user", parts: [{ type: "file", mediaType: "image/png", url: up.url, filename: "pic.png" }, { type: "text", text: "look" }] }];
  const [out] = await inlineFileParts(msgs);
  expect(out.parts[0]).toMatchObject({ type: "file", url: "data:image/png;base64,iVBORw==" });
  expect(out.parts[1]).toEqual({ type: "text", text: "look" });
});

test("saveUpload rejects files over 10 MB and unknown types", async () => {
  const b = await createBot({ name: "Files2", job: "", avatar });
  const big = new File([new Uint8Array(MAX_FILE_BYTES + 1)], "big.png", { type: "image/png" });
  await expect(saveUpload(b.id, big)).rejects.toMatchObject({ status: 413 });
  const zip = new File([new Uint8Array(4)], "a.zip", { type: "application/zip" });
  await expect(saveUpload(b.id, zip)).rejects.toMatchObject({ status: 415 });
});
