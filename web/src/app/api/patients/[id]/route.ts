import { errorResponse, requestDb } from "@/server/http";
import { getPatientDetail } from "@/server/queries";

export async function GET(_req: Request, ctx: RouteContext<"/api/patients/[id]">) {
  const db = await requestDb();
  const { id } = await ctx.params;
  const patient = getPatientDetail(db, id);
  return patient ? Response.json(patient) : errorResponse("Patient not found", 404);
}
