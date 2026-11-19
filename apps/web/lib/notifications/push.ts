import { eq } from "drizzle-orm";
import webpush from "web-push";
import { getDb } from "../db/client";
import { pushSubscriptions } from "../db/schema";
import { getSetting, setSetting } from "../settings";
import { seal, unseal } from "../vault";

/**
 * Web Push: lets the installed app show a notification when no Grid tab is open. The
 * message travels through the browser's push service encrypted end to end (it can't
 * read it). Keys are made once per install; the private one is sealed in the vault.
 */

export type PushSubscriptionJSON = { endpoint: string; keys: { p256dh: string; auth: string } };
export type PushPayload = { title: string; body: string; url: string; tag: string };
export type PushTransport = (
  sub: PushSubscriptionJSON,
  payload: string,
  opts: { vapidDetails?: { subject: string; publicKey: string; privateKey: string }; TTL?: number; timeout?: number },
) => Promise<{ statusCode: number }>;

/** Identifies the sender to push services without saying anything about the user. */
const SUBJECT = "mailto:notifications@grid.invalid";

const g = globalThis as unknown as { __gridPushTransport?: PushTransport | null };
const transport = (): PushTransport => g.__gridPushTransport ?? ((sub, payload, opts) => webpush.sendNotification(sub, payload, opts));

/** Tests replace the network call; null restores it. */
export function setPushTransportForTests(t: PushTransport | null): void {
  g.__gridPushTransport = t;
}

type Stored = { publicKey: string; privateKey: string };

async function keys(): Promise<Stored> {
  const stored = await getSetting<Stored>("vapid");
  if (stored) return { publicKey: stored.publicKey, privateKey: await unseal(stored.privateKey) };
  const fresh = webpush.generateVAPIDKeys();
  await setSetting("vapid", { publicKey: fresh.publicKey, privateKey: await seal(fresh.privateKey) });
  return fresh;
}

export async function pushPublicKey(): Promise<string> {
  return (await keys()).publicKey;
}

export async function savePushSubscription(sub: PushSubscriptionJSON): Promise<void> {
  const db = await getDb();
  const row = { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth };
  await db.insert(pushSubscriptions).values(row).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { p256dh: row.p256dh, auth: row.auth } });
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const db = await getDb();
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

/** Pushes to every subscribed browser; drops ones the push service says are gone. Returns how many got it. */
export async function sendPush(payload: PushPayload): Promise<number> {
  const db = await getDb();
  const subs = await db.select().from(pushSubscriptions);
  if (subs.length === 0) return 0;
  const k = await keys();
  const body = JSON.stringify(payload);
  let sent = 0;
  for (const s of subs) {
    try {
      await transport()({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
        vapidDetails: { subject: SUBJECT, publicKey: k.publicKey, privateKey: k.privateKey },
        TTL: 60 * 60,
        timeout: 10_000,
      });
      sent += 1;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await removePushSubscription(s.endpoint);
      else console.error("[grid] push failed:", status ?? e);
    }
  }
  return sent;
}
