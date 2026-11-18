import { statSync } from "node:fs";
import path from "node:path";
import { useTempHome } from "./test-home";
import { seal, unseal } from "./vault";

const home = useTempHome();

test("seal/unseal round-trips and ciphertext differs each time", async () => {
  const a = await seal("sk-test-123");
  const b = await seal("sk-test-123");
  expect(a).not.toEqual(b);
  expect(a.startsWith("v1:")).toBe(true);
  expect(await unseal(a)).toBe("sk-test-123");
});

test("unseal rejects tampered ciphertext", async () => {
  const s = await seal("x");
  const bad = s.slice(0, -2) + (s.at(-2) === "A" ? "B" : "A") + s.slice(-1);
  await expect(unseal(bad)).rejects.toThrow();
});

test("unseal rejects malformed input", async () => {
  await expect(unseal("not-sealed")).rejects.toThrow();
});

test.skipIf(process.platform === "win32")("master key file is created with owner-only permissions", async () => {
  await seal("x");
  expect(statSync(path.join(home, "master.key")).mode & 0o077).toBe(0);
});
