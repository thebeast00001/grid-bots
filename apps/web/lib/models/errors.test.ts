import { GridModelError, HttpError, toGridError } from "./errors";

test("toGridError maps HTTP statuses", () => {
  expect(toGridError(new HttpError(401, null)).code).toBe("auth");
  expect(toGridError(new HttpError(403, null)).code).toBe("auth");
  expect(toGridError(new HttpError(429, null)).code).toBe("limit");
  expect(toGridError(new HttpError(503, null)).code).toBe("unavailable");
  expect(toGridError({ statusCode: 401 }).code).toBe("auth"); // AI SDK APICallError shape
});

test("toGridError maps refused connections to network with the provider's name", () => {
  const e = new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
  const g = toGridError(e, "Ollama");
  expect(g.code).toBe("network");
  expect(g.message).toBe("Can't reach Ollama.");
});

test("toGridError keeps GridModelErrors as they are", () => {
  const original = new GridModelError("limit", "x");
  expect(toGridError(original)).toBe(original);
});

test("unknown errors become unknown with their message", () => {
  const g = toGridError(new Error("boom"));
  expect(g).toMatchObject({ code: "unknown", message: "boom" });
});
