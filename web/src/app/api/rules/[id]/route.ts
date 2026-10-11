import { UpdateRuleInput, updateRule } from "@/server/commands";
import { handle, parseBody, requestDb } from "@/server/http";

export async function PATCH(request: Request, ctx: RouteContext<"/api/rules/[id]">) {
  return handle(async () => {
    const db = await requestDb();
    const { id } = await ctx.params;
    const input = await parseBody(request, UpdateRuleInput);
    if (input instanceof Response) return input;
    updateRule(db, id, input);
    return Response.json({ ok: true });
  });
}
