import { z } from "zod";
import { setLiveMessages } from "@/server/commands";
import { liveMessagesOn } from "@/server/db/settings";
import { handle, laptopOnly, parseBody, requestDb } from "@/server/http";

export async function GET() {
  return Response.json({ liveMessages: liveMessagesOn(await requestDb()) });
}

const Body = z.object({ liveMessages: z.boolean() });

export async function PUT(request: Request) {
  return handle(async () => {
    const db = await requestDb();
    const denied = laptopOnly(request);
    if (denied) return denied;
    const body = await parseBody(request, Body);
    if (body instanceof Response) return body;
    setLiveMessages(db, body.liveMessages);
    return Response.json({ liveMessages: liveMessagesOn(db) });
  });
}
