import http from "node:http";

export type Loopback = { port: number; close: () => void };

/**
 * One-shot HTTP listener on 127.0.0.1 for the OAuth redirect. Tries each port
 * in order. The handler returns where to send the browser next.
 */
export async function listenOnce(
  ports: number[],
  path: string,
  handle: (url: URL) => Promise<string>,
  timeoutMs = 5 * 60_000,
): Promise<Loopback> {
  for (const port of ports) {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
      if (url.pathname !== path) {
        res.writeHead(404).end();
        return;
      }
      let location: string;
      try {
        location = await handle(url);
      } catch {
        location = "about:blank";
      }
      // Shut down only after the redirect has been flushed, or the browser sees a reset.
      res.writeHead(302, { location, "cache-control": "no-store", connection: "close" }).end(() => close());
    });
    const timer = setTimeout(() => close(), timeoutMs);
    const close = () => {
      clearTimeout(timer);
      server.close();
    };
    const ok = await new Promise<boolean>((resolve) => {
      server.once("error", () => resolve(false));
      server.listen(port, "127.0.0.1", () => resolve(true));
    });
    if (ok) return { port, close };
    clearTimeout(timer);
  }
  throw new Error(`No free port for sign-in (${ports.join(", ")})`);
}
