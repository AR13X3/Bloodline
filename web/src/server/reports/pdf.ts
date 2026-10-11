// Renders a synthetic pathology report as a PDF.
// Output is byte-identical for the same input (fixed metadata dates, no
// random ids), so the OCR cache keyed by file hash keeps working.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface SyntheticReportRow {
  testName: string;
  value: string;
  unit: string;
  range: string;
  flag: string;
}

export interface SyntheticReport {
  labName: string;
  labReference: string;
  patient: { name: string; sex: "F" | "M"; dateOfBirth: string; practiceRef: string };
  requestingGp: string;
  collectedAt: Date;
  reportedAt: Date;
  panelName: string;
  rows: SyntheticReportRow[];
  comment: string | null;
}

const NAVY = rgb(0.043, 0.122, 0.227);
const TEAL = rgb(0.078, 0.553, 0.506);
const GREY = rgb(0.4, 0.43, 0.47);
const LIGHT = rgb(0.93, 0.95, 0.96);
const RED = rgb(0.75, 0.15, 0.2);

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric", timeZone: "Australia/Sydney" });
}

function formatDateTime(d: Date): string {
  const time = d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Australia/Sydney" });
  return `${formatDate(d)} ${time}`;
}

function text(page: PDFPage, s: string, x: number, y: number, font: PDFFont, size: number, color = NAVY) {
  page.drawText(s, { x, y, size, font, color });
}

export async function renderReportPdf(report: SyntheticReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${report.panelName} - ${report.labReference}`);
  doc.setAuthor(report.labName);
  doc.setSubject("Synthetic pathology report - not for clinical use");
  doc.setCreator("BloodLine simulator");
  doc.setProducer("BloodLine simulator");
  doc.setCreationDate(report.reportedAt);
  doc.setModificationDate(report.reportedAt);

  const page = doc.addPage([595.28, 841.89]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const left = 48;
  const right = width - 48;

  // Header band
  page.drawRectangle({ x: 0, y: height - 92, width, height: 92, color: NAVY });
  text(page, report.labName, left, height - 46, bold, 18, rgb(1, 1, 1));
  text(page, "Pathology report", left, height - 68, regular, 11, rgb(0.8, 0.88, 0.9));
  text(page, "SYNTHETIC - NOT FOR CLINICAL USE", right - bold.widthOfTextAtSize("SYNTHETIC - NOT FOR CLINICAL USE", 9), height - 46, bold, 9, rgb(1, 0.78, 0.4));

  // Patient and request details
  let y = height - 128;
  const label = (s: string, x: number, yy: number) => text(page, s, x, yy, regular, 8, GREY);
  const value = (s: string, x: number, yy: number) => text(page, s, x, yy, bold, 10.5);
  const col2 = left + 270;

  label("PATIENT", left, y);
  label("REQUESTING DOCTOR", col2, y);
  y -= 15;
  value(report.patient.name, left, y);
  value(report.requestingGp, col2, y);
  y -= 22;
  label("DATE OF BIRTH", left, y);
  label("SEX", left + 120, y);
  label("PRACTICE REFERENCE", col2, y);
  y -= 15;
  value(formatDate(new Date(`${report.patient.dateOfBirth}T00:00:00Z`)), left, y);
  value(report.patient.sex === "F" ? "Female" : "Male", left + 120, y);
  value(report.patient.practiceRef, col2, y);
  y -= 22;
  label("COLLECTED", left, y);
  label("REPORTED", left + 120, y);
  label("LAB REFERENCE", col2, y);
  y -= 15;
  text(page, formatDateTime(report.collectedAt), left, y, regular, 10);
  text(page, formatDateTime(report.reportedAt), left + 120, y, regular, 10);
  text(page, report.labReference, col2, y, regular, 10);

  // Results table
  y -= 36;
  text(page, report.panelName, left, y, bold, 13, TEAL);
  y -= 12;
  const cols = { test: left + 8, result: left + 190, unit: left + 270, range: left + 360, flag: right - 40 };
  page.drawRectangle({ x: left, y: y - 20, width: right - left, height: 20, color: LIGHT });
  for (const [key, title] of [
    ["test", "Test"],
    ["result", "Result"],
    ["unit", "Units"],
    ["range", "Reference range"],
    ["flag", "Flag"],
  ] as const) {
    text(page, title, cols[key], y - 14, bold, 9, GREY);
  }
  y -= 20;

  for (const row of report.rows) {
    y -= 22;
    const flagged = row.flag.trim() !== "";
    const resultFont = flagged ? bold : regular;
    const resultColour = flagged ? RED : NAVY;
    text(page, row.testName, cols.test, y + 7, regular, 10.5);
    text(page, row.value, cols.result, y + 7, resultFont, 10.5, resultColour);
    text(page, row.unit, cols.unit, y + 7, regular, 10);
    text(page, row.range, cols.range, y + 7, regular, 10);
    if (flagged) text(page, row.flag, cols.flag, y + 7, bold, 10.5, RED);
    page.drawLine({ start: { x: left, y: y }, end: { x: right, y: y }, thickness: 0.5, color: LIGHT });
  }

  // Comment
  if (report.comment) {
    y -= 34;
    text(page, "Comment", left, y, bold, 10.5, TEAL);
    y -= 16;
    for (const line of wrap(report.comment, regular, 10, right - left)) {
      text(page, line, left, y, regular, 10);
      y -= 14;
    }
  }

  // Footer
  page.drawLine({ start: { x: left, y: 64 }, end: { x: right, y: 64 }, thickness: 0.5, color: LIGHT });
  text(page, "Synthetic demo report generated by the BloodLine simulator. All names and results are fictional.", left, 48, regular, 8, GREY);

  return doc.save({ useObjectStreams: false });
}

function wrap(s: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of s.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
