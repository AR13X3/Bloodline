import { errorResponse, requestDb } from "@/server/http";
import { getAlertDetail } from "@/server/queries";

export async function GET(_req: Request, ctx: RouteContext<"/api/alerts/[id]">) {
  const db = await requestDb();
  const { id } = await ctx.params;
  const alert = getAlertDetail(db, id);
  return alert ? Response.json(alert) : errorResponse("Alert not found", 404);
}
