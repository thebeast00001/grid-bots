/**
 * Grid's API listens on the user's own machine. Any web page open in the same
 * browser can still send requests to it, so every API request must:
 * - name a loopback host on Grid's own port (stops DNS rebinding),
 * - come from Grid's own origin when the browser says where it came from,
 * - carry `x-grid: 1` if it changes anything (forces a CORS preflight that
 *   other sites can't pass).
 */

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export type GuardResult = { ok: true } | { ok: false; reason: "host" | "origin" | "header" };

function isLoopback(hostname: string, port: string, expectedPort: number): boolean {
  return LOOPBACK.has(hostname.toLowerCase()) && Number(port || 80) === expectedPort;
}

export function checkRequest(req: { method: string; headers: Headers; port: number }): GuardResult {
  const host = req.headers.get("host") ?? "";
  let hostUrl: URL;
  try {
    hostUrl = new URL(`http://${host}`);
  } catch {
    return { ok: false, reason: "host" };
  }
  if (!isLoopback(hostUrl.hostname, hostUrl.port, req.port)) return { ok: false, reason: "host" };

  const origin = req.headers.get("origin");
  if (origin !== null) {
    let o: URL;
    try {
      o = new URL(origin);
    } catch {
      return { ok: false, reason: "origin" };
    }
    if (o.protocol !== "http:" || !isLoopback(o.hostname, o.port, req.port)) return { ok: false, reason: "origin" };
  }

  if (!SAFE_METHODS.has(req.method.toUpperCase()) && req.headers.get("x-grid") !== "1") {
    return { ok: false, reason: "header" };
  }
  return { ok: true };
}
