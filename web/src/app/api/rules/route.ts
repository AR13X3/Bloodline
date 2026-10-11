import { CreateRuleInput, createRule } from "@/server/commands";
import { handle, parseBody, requestDb } from "@/server/http";

export async function POST(request: Request) {
  return handle(async () => {
    const db = await requestDb();
    const input = await parseBody(request, CreateRuleInput);
    if (input instanceof Response) return input;
    return Response.json(createRule(db, input), { status: 201 });
  });
}
