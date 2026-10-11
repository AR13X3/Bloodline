// Asks the AI to transcribe a report PDF into fields. Transcription only:
// it never decides what is abnormal. All checks happen in deterministic code.
import { z } from "zod";
import type { ExtractedResult } from "../checks/types";

const INSTRUCTIONS = `You are transcribing a pathology report for software. Copy what is printed, exactly.

Rules:
- Return one entry for every test row in the results table.
- testName, value, unit, referenceRange and labFlag: copy the characters exactly as printed in that row. Do not convert units, round, calculate, correct or reformat anything.
- If a column is empty for that row, use null. Never add a flag that is not printed.
- labComment: a comment printed specifically about that test, otherwise null.
- reportComment: the lab's general comment about the results, otherwise null. Ignore page headers, footers and disclaimers.
- patientName: the patient's name exactly as printed, otherwise null.
- Do not interpret, diagnose or give advice.`;

const nullableString = { type: ["string", "null"] };

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["results", "reportComment", "patientName"],
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["testName", "value", "unit", "referenceRange", "labFlag", "labComment"],
        properties: {
          testName: { type: "string" },
          value: { type: "string" },
          unit: nullableString,
          referenceRange: nullableString,
          labFlag: nullableString,
          labComment: nullableString,
        },
      },
    },
    reportComment: nullableString,
    patientName: nullableString,
  },
} as const;

const AiOutput = z.object({
  results: z
    .array(
      z.object({
        testName: z.string().min(1),
        value: z.string(),
        unit: z.string().nullable(),
        referenceRange: z.string().nullable(),
        labFlag: z.string().nullable(),
        labComment: z.string().nullable(),
      }),
    )
    .min(1),
  reportComment: z.string().nullable(),
  patientName: z.string().nullable(),
});

export interface AiExtraction {
  results: ExtractedResult[];
  patientName: string | null;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export async function extractWithAi(pdf: Uint8Array, fileName: string): Promise<AiExtraction> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  const model = process.env.OPENROUTER_MODEL?.trim() || "anthropic/claude-haiku-5.5";

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(45_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "BloodLine demo",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      reasoning: { effort: "low" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: INSTRUCTIONS },
            {
              type: "file",
              file: { filename: fileName, file_data: `data:application/pdf;base64,${Buffer.from(pdf).toString("base64")}` },
            },
          ],
        },
      ],
      plugins: [{ id: "file-parser", pdf: { engine: "native" } }],
      response_format: { type: "json_schema", json_schema: { name: "pathology_report", strict: true, schema: JSON_SCHEMA } },
      provider: { require_parameters: true },
      usage: { include: true },
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | {
        model?: string;
        choices?: { message?: { content?: string | null }; finish_reason?: string }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
        error?: { message?: string };
      }
    | null;
  if (!response.ok || !body) {
    throw new Error(`OpenRouter HTTP ${response.status}: ${body?.error?.message ?? "no response body"}`);
  }

  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error(`AI returned no content (finish reason: ${body.choices?.[0]?.finish_reason ?? "unknown"})`);

  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw new Error("AI output was not valid JSON");
  }
  const parsed = AiOutput.safeParse(json);
  if (!parsed.success) throw new Error(`AI output didn't match the schema: ${parsed.error.issues[0]?.message}`);

  const { results, reportComment, patientName } = parsed.data;
  return {
    results: results.map((r) => ({ ...r, labComment: r.labComment ?? reportComment })),
    patientName,
    model: body.model ?? model,
    inputTokens: body.usage?.prompt_tokens ?? null,
    outputTokens: body.usage?.completion_tokens ?? null,
    costUsd: body.usage?.cost ?? null,
  };
}
