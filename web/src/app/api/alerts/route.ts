import { errorResponse, requestDb } from "@/server/http";
import { listAlerts } from "@/server/queries";

export async function GET(request: Request) {
  const db = await requestDb();
  const clinicianId = new URL(request.url).searchParams.get("clinicianId");
  if (!clinicianId) return errorResponse("clinicianId is required", 400);
  return Response.json(listAlerts(db, clinicianId));
}
