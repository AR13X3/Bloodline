import { subscribe, type LiveEvent } from "@/server/events";
import { requestDb } from "@/server/http";

// Server-Sent Events: live pipeline steps, alerts and messages for the dashboard.
export async function GET(request: Request) {
  await requestDb();
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const send = (event: LiveEvent | { type: "hello"; at: string }) => write(`data: ${JSON.stringify(event)}\n\n`);

      send({ type: "hello", at: new Date().toISOString() });
      const unsubscribe = subscribe(send);
      const keepAlive = setInterval(() => write(": ping\n\n"), 15_000);
      cleanup = () => {
        clearInterval(keepAlive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      request.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
