import { requestDb } from "@/server/http";

export async function GET() {
  await requestDb();
  return Response.json({ ok: true, name: "BloodLine", time: new Date().toISOString() });
}
