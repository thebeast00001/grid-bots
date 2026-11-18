import { randomBytes } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { providers, type ProviderRow } from "../db/schema";
import { seal, unseal } from "../vault";
import { listModels } from "./catalog";
import { GridModelError, SETTINGS_ACTION } from "./errors";
import { PROVIDER_KINDS, isProviderKind, type ProviderKind } from "./kinds";

export type ProviderView = { id: string; kind: ProviderKind; label: string; baseUrl: string | null; hint: string | null };
export type ProviderSecret = Record<string, unknown>;
export type LoadedProvider = ProviderView & { secret: ProviderSecret | null };

function hintFor(secret: ProviderSecret | null): string | null {
  if (typeof secret?.apiKey === "string" && secret.apiKey.length >= 4) return secret.apiKey.slice(-4);
  if (typeof secret?.email === "string") return secret.email;
  return null;
}

async function toLoaded(row: ProviderRow): Promise<LoadedProvider> {
  const secret = row.secret ? (JSON.parse(await unseal(row.secret)) as ProviderSecret) : null;
  return { id: row.id, kind: row.kind as ProviderKind, label: row.label, baseUrl: row.baseUrl, hint: hintFor(secret), secret };
}

const view = ({ secret: _secret, ...rest }: LoadedProvider): ProviderView => rest;

export async function addProvider(input: {
  kind: ProviderKind;
  label?: string;
  baseUrl?: string;
  apiKey?: string;
  secret?: ProviderSecret;
}): Promise<ProviderView> {
  if (!isProviderKind(input.kind)) throw new GridModelError("unsupported", `Unknown provider "${input.kind}".`);
  const info = PROVIDER_KINDS[input.kind];
  const apiKey = input.apiKey?.trim();
  if (info.auth === "key" && !apiKey) {
    throw new GridModelError("auth", `Paste your ${info.label} API key.`, { action: SETTINGS_ACTION });
  }
  const baseUrl = (input.baseUrl?.trim() || info.baseUrl || null)?.replace(/\/+$/, "") ?? null;
  if (input.kind === "custom" && !baseUrl) throw new GridModelError("unsupported", "Enter the server address.");
  const secret: ProviderSecret | null = input.secret ?? (apiKey ? { apiKey } : null);

  // Prove it works before saving anything.
  await listModels({ kind: input.kind, baseUrl, secret });

  const row: ProviderRow = {
    id: `prov_${randomBytes(6).toString("hex")}`,
    kind: input.kind,
    label: input.label?.trim() || info.label,
    baseUrl,
    secret: secret ? await seal(JSON.stringify(secret)) : null,
    createdAt: new Date().toISOString(),
  };
  const db = await getDb();
  await db.insert(providers).values(row);
  return view(await toLoaded(row));
}

export async function listProviders(): Promise<ProviderView[]> {
  const db = await getDb();
  const rows = await db.select().from(providers).orderBy(asc(providers.createdAt));
  return Promise.all(rows.map(async (r) => view(await toLoaded(r))));
}

export async function loadProvider(id: string): Promise<LoadedProvider> {
  const db = await getDb();
  const [row] = await db.select().from(providers).where(eq(providers.id, id));
  if (!row) throw new GridModelError("no-model", "That model connection was removed.", { action: { label: "Connect a model", href: "/welcome" } });
  return toLoaded(row);
}

export async function updateProviderSecret(id: string, secret: ProviderSecret): Promise<void> {
  const db = await getDb();
  await db.update(providers).set({ secret: await seal(JSON.stringify(secret)) }).where(eq(providers.id, id));
}

export async function removeProvider(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(providers).where(eq(providers.id, id));
}
