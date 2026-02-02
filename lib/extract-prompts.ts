/**
 * Prompts for priority-analysis extraction of party decisive respect.
 * Uses only political respects; no ontological operators (same/change/rest/etc.).
 * Decisive respect = the consideration that orders, limits, or justifies all others in the text.
 */

import { PIPELINE_RESPECTS, type PipelineRespectId } from "@/lib/pipeline/taxonomy";

/** Special value when no single respect clearly orders the others. */
export const MIXED_INDETERMINATE = "mixed_indeterminate";

/** Political respects list with judgement question and keyword_seeds for categorisation. */
const POLITICAL_RESPECTS_LIST = PIPELINE_RESPECTS.map(
  (r) => `- ${r.id}: ${r.label} (${r.judgement_question}) [keywords: ${r.keyword_seeds.join(", ")}]`
).join("\n");

export function buildExtractSystemPrompt(): string {
  return `You are an analyst identifying a party's decisive respect from their manifesto or policy text.

**Decisive respect** is the consideration that orders, limits, or justifies all other considerations in the party's own account. It is NOT "which topic appears most" but "which consideration is treated as the constraint or justification for everything else."

**Signals of decisiveness (priority relations):**
- Other concerns are subordinated to it ("We will do X while ensuring Y"; "Any policy must comply with Z")
- It is used as a constraint ("we will do X, but only insofar as…")
- It functions as a justification ("because of X, we must…")
- Explicit priority language: "Our priority is…", "First and foremost…", "We will not compromise on…", "Even if…, we must…"

**Political respects (use these exact IDs):**
${POLITICAL_RESPECTS_LIST}

**Rules:**
1. For each subject, identify exactly ONE primary respect that the text treats as decisive — i.e. the one that other aims are justified by, constrained by, or subordinated to.
2. Optionally list secondary respect(s) — those acknowledged but explicitly balanced, limited, or conditional relative to the primary.
3. If no single respect clearly orders the others, set primary_respect to "mixed_indeterminate" and explain in priority_rationale. That is an analytically meaningful result.
4. priority_rationale: one or two sentences explaining why this respect is decisive (which textual signals show ordering/constraint/justification).
5. authoritative_sources: short references to where in the text this is established (e.g. "Manifesto 2024 – Migration section p.12").
6. Respond only with valid JSON matching the required schema. No commentary outside the JSON.`;
}

export interface ExtractUserPromptOptions {
  /** When migration/immigration/small boats etc. are in scope, pass excerpts extracted by neighbourhood (trigger + surrounding text). The LLM should use these to categorise into the taxonomy (security_border, humanitarian, etc.). Key = subject_id, value = excerpt text. */
  relevantExcerptsBySubject?: Record<string, string>;
}

export function buildExtractUserPrompt(
  partyLabel: string,
  manifestoText: string,
  subjects: { id: string; label: string }[],
  options: ExtractUserPromptOptions = {}
): string {
  const subjectList = subjects.map((s) => `${s.id}: ${s.label}`).join("\n");
  const { relevantExcerptsBySubject } = options;

  let excerptsBlock = "";
  if (relevantExcerptsBySubject && Object.keys(relevantExcerptsBySubject).length > 0) {
    excerptsBlock =
      "\n**Relevant excerpts (migration/immigration/small boats etc.):** These passages were located by trigger keywords (e.g. migration, small boats, asylum) and expanded to include surrounding context. Use them to decide which taxonomy label (security_border, humanitarian, rule_of_law, etc.) best captures the party's decisive respect for each subject.\n\n";
    for (const sub of subjects) {
      const excerpt = relevantExcerptsBySubject[sub.id]?.trim();
      if (excerpt && excerpt.length > 0) {
        excerptsBlock += `--- Relevant excerpts for subject "${sub.id}" (${sub.label}) ---\n${excerpt}\n\n`;
      }
    }
  }

  return `Party: ${partyLabel}

Subjects to analyse (use these exact subject ids in your output):
${subjectList}
${excerptsBlock}
Manifesto text (excerpt or full):
---
${manifestoText.slice(0, 28000)}
---

For each subject, output a JSON object with this structure (one entry per subject):
{
  "positions": [
    {
      "subject_id": "<subject id from list>",
      "primary_respect": "<exact id from political respects list, or mixed_indeterminate>",
      "secondary_respects": ["<id>", "<id>"],
      "priority_rationale": "<one or two sentences: which textual signals show that this respect orders/constrains/justifies others>",
      "authoritative_sources": [
        "<short ref e.g. Manifesto 2024 – Migration section p.12>"
      ]
    }
  ]
}

Use only the political respect IDs listed in the system prompt. When relevant excerpts are provided for a subject, base your categorisation on the framing language in those excerpts (and the keyword hints per respect). Return only the JSON object.`;
}

export type PoliticalRespectIdForExtract = PipelineRespectId | typeof MIXED_INDETERMINATE;
