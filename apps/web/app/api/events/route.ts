import { subscribe } from "@/lib/events";

export const dynamic = "force-dynamic";

const PING_MS = 25_000;

/** Server-sent events: one `data:` line per GridEvent while the app is open. */
export async function GET(req: Request) {
  const enc = new TextEncoder();
  let stop = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          stop();
        }
      };
      const off = subscribe((e) => send(`data: ${JSON.stringify(e)}\n\n`));
      const ping = setInterval(() => send(": ping\n\n"), PING_MS);
      stop = () => {
        off();
        clearInterval(ping);
      };
      req.signal.addEventListener("abort", () => {
        stop();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });
      // Reconnect quickly after a server restart.
      send("retry: 2000\n\n");
    },
    cancel() {
      stop();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
