import { SCENARIOS } from "@/server/simulator/scenarios";

export function GET() {
  return Response.json(
    SCENARIOS.map(({ id, title, description, expected, patientId, panelName }) => ({ id, title, description, expected, patientId, panelName })),
  );
}
