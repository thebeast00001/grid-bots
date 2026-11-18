import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dataPath, ensureHome } from "./paths";

/**
 * Seals secrets (API keys, OAuth tokens) with AES-256-GCM under a per-install
 * master key stored at `GRID_HOME/master.key` (owner-only permissions).
 */

const keys = new Map<string, Promise<Buffer>>();

async function loadOrCreateKey(file: string): Promise<Buffer> {
  try {
    const key = await readFile(file);
    if (key.length !== 32) throw new Error(`master key at ${file} is not 32 bytes`);
    return key;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  await ensureHome();
  const key = randomBytes(32);
  try {
    await writeFile(file, key, { mode: 0o600, flag: "wx" });
    return key;
  } catch (e) {
    // Another caller created it first: use theirs.
    if ((e as NodeJS.ErrnoException).code === "EEXIST") return readFile(file);
    throw e;
  }
}

function masterKey(): Promise<Buffer> {
  const file = dataPath("master.key");
  let key = keys.get(file);
  if (!key) {
    key = loadOrCreateKey(file);
    keys.set(file, key);
  }
  return key;
}

const b64 = (b: Buffer) => b.toString("base64url");

export async function seal(plain: string): Promise<string> {
  const key = await masterKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${b64(iv)}:${b64(cipher.getAuthTag())}:${b64(ct)}`;
}

export async function unseal(sealed: string): Promise<string> {
  const [version, iv, tag, ct] = sealed.split(":");
  if (version !== "v1" || !iv || !tag || ct === undefined) throw new Error("not a sealed value");
  const key = await masterKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
