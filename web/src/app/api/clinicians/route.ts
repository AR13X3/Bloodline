import { requestDb } from "@/server/http";
import { listClinicians } from "@/server/queries";

export async function GET() {
  return Response.json(listClinicians(await requestDb()));
}
