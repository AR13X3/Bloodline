// Gets the transcribed results for a report: from the cache, from the AI,
// or (simulator reports only, clearly labelled) from what the simulator printed.
import type { DatabaseSync } from "node:sqlite";
import type { ExtractedResult } from "../checks/types";
import { aiConfigured, extractWithAi } from "./ai";

export type ExtractionOutcome =
  | { source: "cache" | "ai"; results: ExtractedResult[]; model: string; costUsd: number | null }
  | { source: "fallback"; results: ExtractedResult[]; reason: string }
  | { source: "failed"; error: string };

export async function extractReport(
  db: DatabaseSync,
  input: { fileHash: string; pdf: Uint8Array; fileName: string; sourceRows?: ExtractedResult[] },
): Promise<ExtractionOutcome> {
  const cached = db
    .prepare("SELECT model, extraction_json, cost_usd FROM extraction_cache WHERE file_hash = ?")
    .get(input.fileHash) as { model: string; extraction_json: string; cost_usd: number | null } | undefined;
  if (cached) {
    return { source: "cache", results: JSON.parse(cached.extraction_json), model: cached.model, costUsd: 0 };
  }

  let aiError: string;
  if (aiConfigured()) {
    try {
      const ai = await extractWithAi(input.pdf, input.fileName);
      db.prepare(
        `INSERT OR REPLACE INTO extraction_cache (file_hash, model, extraction_json, input_tokens, output_tokens, cost_usd, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(input.fileHash, ai.model, JSON.stringify(ai.results), ai.inputTokens, ai.outputTokens, ai.costUsd, new Date().toISOString());
      return { source: "ai", results: ai.results, model: ai.model, costUsd: ai.costUsd };
    } catch (err) {
      aiError = err instanceof Error ? err.message : String(err);
    }
  } else {
    aiError = "AI reading is not configured";
  }

  if (input.sourceRows?.length) {
    return { source: "fallback", results: input.sourceRows, reason: aiError };
  }
  return { source: "failed", error: aiError };
}
