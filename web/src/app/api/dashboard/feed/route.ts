import { requestDb } from "@/server/http";
import { getDashboardFeed } from "@/server/queries";

export async function GET() {
  return Response.json(getDashboardFeed(await requestDb()));
}
