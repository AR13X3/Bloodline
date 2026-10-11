import { z } from "zod";
import { errorResponse, handle, laptopOnly, parseBody, requestDb } from "@/server/http";
import { ingestReport } from "@/server/pipeline/ingest";
import { renderReportPdf } from "@/server/reports/pdf";
import { buildScenarioReport, getScenario } from "@/server/simulator/scenarios";

const Body = z.object({
  scenario: z.string().min(1),
  /** Re-send with an earlier id to demonstrate duplicate handling. */
  sourceMessageId: z.string().min(1).max(64).optional(),
});

export async function POST(request: Request) {
  return handle(async () => {
    const db = await requestDb();
    const denied = laptopOnly(request);
    if (denied) return denied;
    const body = await parseBody(request, Body);
    if (body instanceof Response) return body;
    const scenario = getScenario(body.scenario);
    if (!scenario) return errorResponse("Unknown scenario", 400);

    const built = buildScenarioReport(db, scenario);
    const pdf = await renderReportPdf(built.report);
    const sourceMessageId = body.sourceMessageId ?? `SIM-${Date.now().toString(36).toUpperCase()}`;
    const summary = await ingestReport(db, {
      pdf,
      fileName: `${scenario.id}-${built.report.labReference}.pdf`,
      origin: "simulator",
      sourceMessageId,
      patientId: built.patientId,
      requestingClinicianId: built.requestingClinicianId,
      labName: built.report.labName,
      collectedAt: built.report.collectedAt.toISOString(),
      sourceRows: built.sourceRows,
      actor: "presenter",
    });
    return Response.json({ sourceMessageId, ...summary });
  });
}
