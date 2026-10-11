import { UpdateSettingsInput, updateClinicianSettings } from "@/server/commands";
import { errorResponse, handle, parseBody, requestDb } from "@/server/http";
import { getClinicianSettings } from "@/server/queries";

export async function GET(_req: Request, ctx: RouteContext<"/api/clinicians/[id]/settings">) {
  const db = await requestDb();
  const { id } = await ctx.params;
  const settings = getClinicianSettings(db, id);
  return settings ? Response.json(settings) : errorResponse("GP not found", 404);
}

export async function PUT(request: Request, ctx: RouteContext<"/api/clinicians/[id]/settings">) {
  return handle(async () => {
    const db = await requestDb();
    const { id } = await ctx.params;
    const input = await parseBody(request, UpdateSettingsInput);
    if (input instanceof Response) return input;
    updateClinicianSettings(db, id, input);
    return Response.json(getClinicianSettings(db, id));
  });
}
