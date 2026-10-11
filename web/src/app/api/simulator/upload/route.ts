import { errorResponse, handle, laptopOnly, requestDb } from "@/server/http";
import { ingestReport } from "@/server/pipeline/ingest";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  return handle(async () => {
    const db = await requestDb();
    const denied = laptopOnly(request);
    if (denied) return denied;

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    const patientId = form?.get("patientId");
    const requestedGp = form?.get("requestingClinicianId");
    if (!(file instanceof File) || typeof patientId !== "string") return errorResponse("Send a PDF file and a patientId", 400);
    if (file.size > MAX_BYTES) return errorResponse("PDF must be under 5 MB", 400);
    const pdf = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(pdf.slice(0, 5)) !== "%PDF-") return errorResponse("That file isn't a PDF", 400);

    const patient = db.prepare("SELECT usual_clinician_id FROM patients WHERE id = ?").get(patientId) as { usual_clinician_id: string } | undefined;
    if (!patient) return errorResponse("Unknown patient", 400);
    const requestingClinicianId = typeof requestedGp === "string" && requestedGp ? requestedGp : patient.usual_clinician_id;
    if (!db.prepare("SELECT 1 FROM clinicians WHERE id = ?").get(requestingClinicianId)) return errorResponse("Unknown GP", 400);

    const sourceMessageId = `UPLOAD-${Date.now().toString(36).toUpperCase()}`;
    const summary = await ingestReport(db, {
      pdf,
      fileName: file.name || "upload.pdf",
      origin: "upload",
      sourceMessageId,
      patientId,
      requestingClinicianId,
      labName: "Uploaded report (synthetic)",
      collectedAt: new Date().toISOString(),
      actor: "presenter",
    });
    return Response.json({ sourceMessageId, ...summary });
  });
}
