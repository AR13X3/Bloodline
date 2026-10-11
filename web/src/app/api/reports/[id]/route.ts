import { errorResponse, requestDb } from "@/server/http";
import { getReport } from "@/server/queries";

export async function GET(_req: Request, ctx: RouteContext<"/api/reports/[id]">) {
  const db = await requestDb();
  const { id } = await ctx.params;
  const report = getReport(db, id);
  return report ? Response.json(report) : errorResponse("Report not found", 404);
}
