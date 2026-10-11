import { requestDb } from "@/server/http";
import { listPatients } from "@/server/queries";

export async function GET() {
  return Response.json(listPatients(await requestDb()));
}
