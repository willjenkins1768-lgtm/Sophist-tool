/**
 * LLM-based media classification: assign each headline to ONE primary political respect.
 * Used when OPENAI_API_KEY is set; falls back to keyword classifier otherwise.
 */

import OpenAI from "openai";
import { PIPELINE_RESPECTS } from "./taxonomy";
import type { PipelineRespectId } from "./taxonomy";
import type { RawMediaItem, ClassifiedItem } from "./types";

const RESPECT_IDS = PIPELINE_RESPECTS.map((r) => r.id);
const RESPECT_LIST = PIPELINE_RESPECTS.map((r) => `- ${r.id}: ${r.label}`).join("\n");

export interface ClassifyMediaLLMOptions {
  subject_id: string;
  items: RawMediaItem[];
}

/** Batch-classify media items with the LLM. Returns ClassifiedItem[] in same order as items. */
export async function classifyMediaWithLLM(options: ClassifyMediaLLMOptions): Promise<ClassifiedItem[]> {
  const { subject_id, items } = options;
  if (items.length === 0) return [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const headlines = items.map((m, i) => `${i}. ${m.title}${m.lede ? ` | ${m.lede.slice(0, 150)}` : ""}`).join("\n");

  const systemPrompt = `You classify UK news headlines into exactly one political "respect" (frame) from the list below.
Reply with valid JSON only: { "classifications": [ { "index": 0, "respect_id": "security_border" }, ... ] }
Each index must match the headline index (0-based). Every respect_id must be one of: ${RESPECT_IDS.join(", ")}.`;

  const userPrompt = `Respects (choose ONE per headline):
${RESPECT_LIST}

Headlines (index. title | lede):
${headlines}

Return JSON: { "classifications": [ { "index": number, "respect_id": string }, ... ] } for all ${items.length} items.`;

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

  let parsed: { classifications?: { index: number; respect_id: string }[] };
  try {
    parsed = JSON.parse(rawContent) as { classifications?: { index: number; respect_id: string }[] };
  } catch {
    return [];
  }
  const classifications = parsed.classifications ?? [];
  const byIndex = new Map(classifications.map((c) => [c.index, c.respect_id]));

  const timestamp = new Date().toISOString();
  return items.map((m, i) => {
    const respect_id = (byIndex.get(i) && RESPECT_IDS.includes(byIndex.get(i)!)
      ? byIndex.get(i)!
      : "security_border") as PipelineRespectId;
    return {
      item_type: "media" as const,
      subject_id,
      item_id: m.id,
      respect_id,
      confidence: 0.8,
      rationale: ["LLM classification"],
      extracted_phrases: [],
      timestamp,
    };
  });
}
