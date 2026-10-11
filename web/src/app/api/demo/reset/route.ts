import { resetDemo } from "@/server/db";
import { emit } from "@/server/events";
import { handle, laptopOnly, requestDb } from "@/server/http";

export async function POST(request: Request) {
  return handle(async () => {
    const db = await requestDb();
    const denied = laptopOnly(request);
    if (denied) return denied;
    resetDemo(db);
    emit({ type: "demo.reset" });
    return Response.json({ ok: true });
  });
}
