/**
 * Server-side priority extraction runner. Used by the Extract API and by the
 * pipeline's automated fetch-and-extract step. Requires OPENAI_API_KEY.
 */

import OpenAI from "openai";
import { buildExtractSystemPrompt, buildExtractUserPrompt, MIXED_INDETERMINATE } from "@/lib/extract-prompts";
import { buildRelevantExcerptsBySubject } from "@/lib/pipeline/passage-extractor";
import { PIPELINE_RESPECT_IDS } from "@/lib/pipeline/taxonomy";
import type { PartyPosition, EvidenceItem } from "@/lib/types";
import type { LLMExtractResponse } from "@/lib/extract-types";

const VALID_PRIMARY_RESPECT = new Set<string>([...PIPELINE_RESPECT_IDS, MIXED_INDETERMINATE]);
const VALID_POLITICAL_RESPECT = new Set<string>(PIPELINE_RESPECT_IDS);

function toPartyPosition(
  raw: LLMExtractResponse["positions"][0],
  partyId: string,
  docId: string,
  asOf: string
): PartyPosition | null {
  const primary = raw.primary_respect?.trim();
  if (!primary || !VALID_PRIMARY_RESPECT.has(primary)) return null;
  if (primary === MIXED_INDETERMINATE) return null;

  const confidence = 0.75;
  const evidence: EvidenceItem[] = (raw.authoritative_sources ?? [])
    .filter((s) => typeof s === "string" && s.trim().length > 0)
    .slice(0, 5)
    .map((s) => ({
      doc_id: docId,
      quote: String(s).trim(),
      section: null,
      quote_verified: false,
      extracted_by: "llm",
    }));

  const secondaryRespects = Array.isArray(raw.secondary_respects)
    ? raw.secondary_respects.filter((id): id is string => typeof id === "string" && VALID_POLITICAL_RESPECT.has(id))
    : [];
  const secondaryPolitical = secondaryRespects[0] ?? null;

  const id = `pp_${raw.subject_id}_${partyId}_${Date.now()}`;
  return {
    id,
    subject_id: raw.subject_id,
    actor_type: "party",
    actor_id: partyId,
    as_of: asOf,
    primary_respect: { respect_id: "same", confidence },
    primary_political_respect: { political_respect_id: primary, confidence },
    secondary_respect: secondaryPolitical ? { respect_id: "same", confidence: confidence * 0.6 } : null,
    secondary_political_respect: secondaryPolitical ? { political_respect_id: secondaryPolitical, confidence: confidence * 0.6 } : null,
    status: "proposed",
    method: { producer: "llm", extraction_mode: "priority_analysis" },
    evidence,
    evidence_quality: secondaryPolitical ? undefined : "weak",
    rationale: raw.priority_rationale ? [raw.priority_rationale] : undefined,
    notes: null,
    human_override: null,
  };
}

export interface RunExtractionOptions {
  partyId: string;
  partyLabel: string;
  manifestoText: string;
  subjects: { id: string; label: string }[];
  docId: string;
}

/**
 * Run priority-analysis extraction on manifesto text. Returns PartyPosition[]
 * for each subject (skips mixed_indeterminate). Requires OPENAI_API_KEY.
 */
export async function runPriorityExtraction(options: RunExtractionOptions): Promise<PartyPosition[]> {
  const { partyId, partyLabel, manifestoText, subjects, docId } = options;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set. Add it in .env.local to run extraction.");
  }

  const systemPrompt = buildExtractSystemPrompt();
  const subjectIds = subjects.map((s) => s.id);
  const relevantExcerptsBySubject = buildRelevantExcerptsBySubject(manifestoText, subjectIds, {
    sentenceWindow: 2,
    maxCharsPerSubject: 12000,
  });
  const userPrompt = buildExtractUserPrompt(partyLabel, manifestoText, subjects, {
    relevantExcerptsBySubject,
  });

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });
  const rawContent = completion.choices[0]?.message?.content ?? "";

  let parsedResponse: LLMExtractResponse;
  try {
    parsedResponse = JSON.parse(rawContent) as LLMExtractResponse;
  } catch {
    throw new Error(`LLM did not return valid JSON: ${rawContent.slice(0, 200)}`);
  }

  const asOf = new Date().toISOString().slice(0, 10);
  const positions = (parsedResponse.positions ?? [])
    .map((p) => toPartyPosition(p, partyId, docId, asOf))
    .filter((p): p is PartyPosition => p != null);
  return positions;
}
