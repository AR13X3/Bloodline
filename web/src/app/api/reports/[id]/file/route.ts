import { readFile } from "node:fs/promises";
import path from "node:path";
import { reportsDir } from "@/server/db";
import { errorResponse, requestDb } from "@/server/http";
import { getReportFileName } from "@/server/queries";

export async function GET(_req: Request, ctx: RouteContext<"/api/reports/[id]/file">) {
  const db = await requestDb();
  const { id } = await ctx.params;
  const fileName = getReportFileName(db, id);
  if (!fileName || !/^[a-f0-9]{64}\.pdf$/.test(fileName)) return errorResponse("Report file not found", 404);
  try {
    const bytes = await readFile(path.join(reportsDir(), fileName));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="bloodline-report-${id.slice(0, 8)}.pdf"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return errorResponse("Report file not found", 404);
  }
}
