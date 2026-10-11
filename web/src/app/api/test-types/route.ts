import { requestDb } from "@/server/http";
import { listTestTypes } from "@/server/queries";

export async function GET() {
  return Response.json(listTestTypes(await requestDb()));
}
