import type { APIRequestContext, Page } from "@playwright/test";

const H = { "x-grid": "1" };

/** Wipes the e2e database (route exists only when GRID_E2E=1). */
export async function resetApp(request: APIRequestContext) {
  const res = await request.post("/api/test/reset", { headers: H });
  if (!res.ok()) throw new Error(`reset failed: ${res.status()}`);
}

/** Connects the deterministic test model; the first provider becomes the default. */
export async function connectMock(page: Page) {
  const res = await page.request.post("/api/providers", { headers: H, data: { kind: "mock" } });
  if (!res.ok()) throw new Error(`connectMock failed: ${res.status()} ${await res.text()}`);
}
