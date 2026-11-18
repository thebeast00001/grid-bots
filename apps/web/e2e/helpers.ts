import type { APIRequestContext, Page } from "@playwright/test";

const H = { "x-grid": "1" };

/** Wipes the e2e database (route exists only when GRID_E2E=1). */
export async function resetApp(request: APIRequestContext) {
  const res = await request.post("/api/test/reset", { headers: H });
  if (!res.ok()) throw new Error(`reset failed: ${res.status()}`);
}

/** Creates a bot through the API and returns its id. */
export async function makeBot(page: Page, name: string, opts: { skipInterview?: boolean } = {}): Promise<string> {
  const res = await page.request.post("/api/bots", {
    headers: H,
    data: { name, job: "Helps out", avatar: { shape: "orb", color: 9, eyes: "dot", acc: "none", material: "clay" } },
  });
  if (!res.ok()) throw new Error(`makeBot failed: ${res.status()} ${await res.text()}`);
  const bot = (await res.json()) as { id: string };
  if (opts.skipInterview) {
    const patch = await page.request.patch(`/api/bots/${bot.id}`, { headers: H, data: { interview: "skipped" } });
    if (!patch.ok()) throw new Error(`skipInterview failed: ${patch.status()}`);
  }
  return bot.id;
}

/** Connects the deterministic test model; the first provider becomes the default. */
export async function connectMock(page: Page) {
  const res = await page.request.post("/api/providers", { headers: H, data: { kind: "mock" } });
  if (!res.ok()) throw new Error(`connectMock failed: ${res.status()} ${await res.text()}`);
}
