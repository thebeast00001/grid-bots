import { expect, test } from "@playwright/test";

test("API rejects writes without x-grid", async ({ request }) => {
  const res = await request.post("/api/health");
  expect(res.status()).toBe(403);
});

test("API rejects requests from another origin", async ({ request }) => {
  const res = await request.post("/api/health", { headers: { origin: "https://evil.example", "x-grid": "1" } });
  expect(res.status()).toBe(403);
});

test("API allows the app's own GET", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
});
