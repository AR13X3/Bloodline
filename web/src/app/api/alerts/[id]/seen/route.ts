import { z } from "zod";
import { markAlertSeen } from "@/server/commands";
import { handle, parseBody, requestDb } from "@/server/http";

const Body = z.object({ clinicianId: z.string().min(1) });

export async function POST(request: Request, ctx: RouteContext<"/api/alerts/[id]/seen">) {
  return handle(async () => {
    const db = await requestDb();
    const { id } = await ctx.params;
    const body = await parseBody(request, Body);
    if (body instanceof Response) return body;
    return Response.json(markAlertSeen(db, id, body.clinicianId));
  });
}
