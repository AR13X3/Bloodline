import { errorResponse, requestDb } from "@/server/http";
import { renderReportPdf } from "@/server/reports/pdf";
import { buildScenarioReport, getScenario } from "@/server/simulator/scenarios";

// A synthetic report to download and then upload, so the demo can show the
// real "upload a document" flow.
export async function GET(_req: Request, ctx: RouteContext<"/api/simulator/sample/[scenario]">) {
  const db = await requestDb();
  const { scenario: id } = await ctx.params;
  const scenario = getScenario(id);
  if (!scenario) return errorResponse("Unknown scenario", 404);
  const built = buildScenarioReport(db, scenario);
  const pdf = await renderReportPdf(built.report);
  const name = `${built.report.patient.name.replace(/\s+/g, "-")}-${scenario.labReference}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"` },
  });
}
