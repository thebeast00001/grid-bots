import { createBot } from "../bots/repo";
import { resetDbForTests } from "../db/client";
import { streamClosed, streamOpened } from "../events";
import { getSetting } from "../settings";
import { useTempHome } from "../test-home";
import { pushPublicKey, removePushSubscription, savePushSubscription, sendPush, setPushTransportForTests, type PushTransport } from "./push";
import { notify } from "./repo";

useTempHome();
afterAll(() => resetDbForTests());
afterEach(() => setPushTransportForTests(null));

const avatar = { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" } as const;
const sub = (n: number) => ({ endpoint: `https://push.example/sub/${n}`, keys: { p256dh: `p${n}`, auth: `a${n}` } });

function recorder(fail: Record<string, number> = {}) {
  const sent: { endpoint: string; payload: unknown; subject?: string }[] = [];
  const t: PushTransport = async (s, payload, opts) => {
    if (fail[s.endpoint]) throw Object.assign(new Error("gone"), { statusCode: fail[s.endpoint] });
    sent.push({ endpoint: s.endpoint, payload: JSON.parse(payload), subject: opts.vapidDetails?.subject });
    return { statusCode: 201 };
  };
  return { sent, t };
}

test("VAPID keys are made once; the private one is sealed, never stored in the clear", async () => {
  const key = await pushPublicKey();
  expect(key).toMatch(/^[A-Za-z0-9_-]{80,}$/);
  expect(await pushPublicKey()).toBe(key);
  const stored = JSON.stringify(await getSetting("vapid"));
  expect(stored).toContain("v1:");
  expect(stored).not.toMatch(/"privateKey":"[A-Za-z0-9_-]{40,}"/);
});

test("sends to every subscription; a gone one (410) is removed and the rest still get it", async () => {
  await savePushSubscription(sub(1));
  await savePushSubscription(sub(2));
  const { sent, t } = recorder({ [sub(1).endpoint]: 410 });
  setPushTransportForTests(t);
  expect(await sendPush({ title: "Remy", body: "Pay rent", url: "/bots/b1", tag: "ntf_1" })).toBe(1);
  expect(sent).toEqual([{ endpoint: sub(2).endpoint, payload: { title: "Remy", body: "Pay rent", url: "/bots/b1", tag: "ntf_1" }, subject: "mailto:notifications@grid.invalid" }]);

  const again = recorder();
  setPushTransportForTests(again.t);
  await sendPush({ title: "x", body: "y", url: "/", tag: "t" });
  expect(again.sent.map((s) => s.endpoint)).toEqual([sub(2).endpoint]);
  await removePushSubscription(sub(2).endpoint);
});

test("a ping is pushed only when no app is open to show it", async () => {
  const bot = await createBot({ name: "Pusher", job: "", avatar });
  await savePushSubscription(sub(3));
  const { sent, t } = recorder();
  setPushTransportForTests(t);

  await notify({ botId: bot.id, kind: "reminder", body: "Nobody's looking" });
  expect(sent.map((s) => (s.payload as { body: string }).body)).toEqual(["Nobody's looking"]);

  streamOpened();
  try {
    await notify({ botId: bot.id, kind: "reminder", body: "The tab will show this" });
  } finally {
    streamClosed();
  }
  expect(sent).toHaveLength(1);

  // A notification that doesn't ping is never pushed.
  await notify({ botId: bot.id, kind: "routine", body: "Quiet", importance: "low" });
  expect(sent).toHaveLength(1);
});
