/**
 * LLM-generated summary of why the primary respect was chosen as primary and why secondary is secondary.
 * Used for the party card "Summary of findings" section.
 */

import OpenAI from "openai";
import { getPipelineRespectLabel } from "./taxonomy";
import type { PipelineRespectId } from "./taxonomy";

export interface SummaryOfFindingsInput {
  party_label: string;
  primary_respect_id: PipelineRespectId;
  secondary_respect_id: PipelineRespectId | null;
  evidence_quotes?: string[];
}

/** Generate a short paragraph (2–3 sentences) explaining why primary is primary and secondary is secondary. */
export async function generateSummaryOfFindings(input: SummaryOfFindingsInput): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "";

  const primaryLabel = getPipelineRespectLabel(input.primary_respect_id);
  const secondaryLabel = input.secondary_respect_id
    ? getPipelineRespectLabel(input.secondary_respect_id)
    : "None";

  const evidenceSnippet =
    input.evidence_quotes?.length && input.evidence_quotes[0]
      ? `\nRelevant evidence: "${input.evidence_quotes[0].slice(0, 300)}${input.evidence_quotes[0].length > 300 ? "…" : ""}"`
      : "";

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You write a brief 'Summary of findings' for a party's political stance. In 2–3 sentences, explain why the primary respect (frame) was identified as primary and why the secondary respect is secondary (or why there is no clear secondary). Use clear, neutral language. Do not use bullet points.",
      },
      {
        role: "user",
        content: `Party: ${input.party_label}. Primary respect: ${primaryLabel}. Secondary respect: ${secondaryLabel}.${evidenceSnippet}\n\nWrite the summary of findings (2–3 sentences).`,
      },
    ],
    temperature: 0.3,
    max_tokens: 200,
  });

  const text = completion.choices[0]?.message?.content?.trim();
  return text ?? "";
}
