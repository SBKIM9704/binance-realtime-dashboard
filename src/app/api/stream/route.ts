import { buildSnapshot } from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUSH_INTERVAL_MS = 1000;

/**
 * Server-Sent Events stream. Pushes a fresh dashboard snapshot every second so
 * the client reflects the latest persisted state in near real time.
 */
export function GET(req: Request) {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        try {
          const payload = JSON.stringify(buildSnapshot());
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {
          // Snapshot build failed transiently — skip this tick.
        }
      };
      send();
      timer = setInterval(send, PUSH_INTERVAL_MS);
      req.signal.addEventListener("abort", () => {
        if (timer) clearInterval(timer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      if (timer) clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
