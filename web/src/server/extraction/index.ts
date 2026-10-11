// Gets the transcribed results for a report: from the cache, from the AI,
// or (simulator reports only, clearly labelled) from what the simulator printed.
import type { DatabaseSync } from "node:sqlite";
import type { ExtractedResult } from "../checks/types";
import { aiConfigured, extractWithAi } from "./ai";

export type ExtractionOutcome =
  | { source: "cache" | "ai"; results: ExtractedResult[]; patientName: string | null; model: string; costUsd: number | null }
  | { source: "fallback"; results: ExtractedResult[]; patientName: string | null; reason: string }
  | { source: "failed"; error: string };

interface CachedExtraction {
  results: ExtractedResult[];
  patientName: string | null;
}

function parseCached(json: string): CachedExtraction {
  const value = JSON.parse(json) as CachedExtraction | ExtractedResult[];
  return Array.isArray(value) ? { results: value, patientName: null } : value;
}

export async function extractReport(
  db: DatabaseSync,
  input: { fileHash: string; pdf: Uint8Array; fileName: string; sourceRows?: ExtractedResult[]; sourcePatientName?: string },
): Promise<ExtractionOutcome> {
  const cached = db
    .prepare("SELECT model, extraction_json FROM extraction_cache WHERE file_hash = ?")
    .get(input.fileHash) as { model: string; extraction_json: string } | undefined;
  if (cached) {
    const { results, patientName } = parseCached(cached.extraction_json);
    return { source: "cache", results, patientName, model: cached.model, costUsd: 0 };
  }

  let aiError: string;
  if (aiConfigured()) {
    try {
      const ai = await extractWithAi(input.pdf, input.fileName);
      const toCache: CachedExtraction = { results: ai.results, patientName: ai.patientName };
      db.prepare(
        `INSERT OR REPLACE INTO extraction_cache (file_hash, model, extraction_json, input_tokens, output_tokens, cost_usd, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(input.fileHash, ai.model, JSON.stringify(toCache), ai.inputTokens, ai.outputTokens, ai.costUsd, new Date().toISOString());
      return { source: "ai", results: ai.results, patientName: ai.patientName, model: ai.model, costUsd: ai.costUsd };
    } catch (err) {
      aiError = err instanceof Error ? err.message : String(err);
    }
  } else {
    aiError = "AI reading is not configured";
  }

  if (input.sourceRows?.length) {
    return { source: "fallback", results: input.sourceRows, patientName: input.sourcePatientName ?? null, reason: aiError };
  }
  return { source: "failed", error: aiError };
}
