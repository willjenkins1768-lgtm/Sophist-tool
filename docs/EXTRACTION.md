# Manifesto Extraction: How Relevant Information Is Extracted and Categorised

This document describes how the tool extracts party positions (decisive respect) from manifesto text and how it maps them onto the taxonomy (security/border, humanitarian, rule_of_law, etc.).

---

## 1. Current behaviour (before neighbourhood extraction)

### 1.1 Flow

1. **Extract page** sends: `partyId`, `manifestoText` (full or excerpt), `subjectIds` (e.g. `migration`, `small_boats`), and `subjects` (id + label).
2. **API** (`/api/extract`) calls `runPriorityExtraction()` in `lib/extract-run.ts`.
3. **Prompts** (`lib/extract-prompts.ts`):
   - **System prompt**: Defines “decisive respect” (the consideration that orders, limits, or justifies others), lists political respects with **id**, **label**, and **judgement_question** only. **Taxonomy `keyword_seeds` are not passed to the LLM.**
   - **User prompt**: Party name, list of subjects to analyse, and the **entire manifesto text** (up to 28,000 characters) in one block.
4. **Single LLM call** (OpenAI `gpt-4o-mini`, JSON mode): The model is asked to return one `primary_respect` per subject, plus `secondary_respects`, `priority_rationale`, and `authoritative_sources`.
5. **Post-processing** (`extract-run.ts`): Raw JSON is validated against `PIPELINE_RESPECT_IDS`, converted to `PartyPosition` with evidence and confidence, and returned.

### 1.2 Gaps

- **No subject-linked retrieval**: The system does not first locate where “migration”, “immigration”, “small boats”, etc. are mentioned. The full text is sent as one blob.
- **No neighbourhood**: There is no step that takes a trigger phrase and extracts surrounding sentences/paragraphs to form a “neighbourhood” for classification.
- **Keyword seeds unused in extraction**: `lib/pipeline/taxonomy.ts` defines `keyword_seeds` per respect (e.g. security_border: “stop”, “deter”, “secure”, “crackdown”, “illegal”, “boats”, “crossings”). These are used in the **pipeline classifier** (media/poll/metric items) but **not** in manifesto extraction. The LLM never sees which terms map to which respect.
- **Risk of noise**: Long manifestos can dilute focus; the model may underweight migration-specific passages or overgeneralise from unrelated sections.

---

## 2. Intended behaviour: neighbourhood + keyword → taxonomy

### 2.1 Principle

Whenever **migration**, **immigration**, **small boats**, or related subject triggers are mentioned, the extractor should:

1. **Locate** all passages that mention those triggers.
2. **Expand** each passage to a “neighbourhood” (e.g. surrounding sentences or ±N words) so that framing language (security vs humanitarian vs legal) is captured.
3. **Use** taxonomy **keyword_seeds** in that neighbourhood to inform which respect is in play (security/border, humanitarian, rule_of_law, etc.).
4. **Decide** (via heuristic and/or LLM) how to categorise the party’s decisive respect for that subject, using those neighbourhoods and keyword signals.

### 2.2 Subject trigger keywords

For subjects like **migration** and **small_boats**, the extractor uses trigger phrases to find relevant text. Triggers are matched case-insensitively; they include:

- **Migration (umbrella)**: migration, immigration, immigrate, migrant(s), border(s), asylum, refugee(s), visa(s), entry, settlement, citizenship, channel crossing(s), small boat(s), dinghy, boat(s) crossing, illegal migration, legal migration, etc.
- **Small boats (child of migration)**: small boat(s), channel crossing(s), dinghy, boats crossing, English Channel, irregular crossing(s), etc.

When any of these appear in the manifesto, that location is treated as **subject-relevant** and the surrounding text is taken as the **neighbourhood** for that subject.

### 2.3 Neighbourhood

- **Unit**: Sentence or paragraph (split on `. ` or `\n\n`).
- **Rule**: For each match of a trigger keyword, take the sentence (or paragraph) containing it plus **N** preceding and following sentences (or paragraphs). Default e.g. ±1 paragraph or ±2 sentences so that “stop the boats” and “we must ensure dignity” in the same section are in one neighbourhood.
- **Deduplication**: Overlapping neighbourhoods (e.g. two triggers in the same paragraph) are merged so each stretch of text is analysed once per subject.

### 2.4 Keyword → taxonomy (respect)

The taxonomy in `lib/pipeline/taxonomy.ts` defines, for each **respect**, a **judgement_question** and **keyword_seeds**:

| Respect ID            | Example keyword_seeds                                                                 |
|----------------------|----------------------------------------------------------------------------------------|
| security_border      | stop, deter, secure, crackdown, illegal, enforcement, threat, gangs, border, boats, crossings |
| humanitarian         | dignity, safety, refuge, compassion, harm, rescue, welfare, humanity, protect, vulnerable   |
| rule_of_law           | due process, lawful, ECHR, HRA, courts, obligations, procedures, legal, convention, rights  |
| sovereignty_control  | control, sovereignty, mandate, Parliament, take back control                            |
| capacity_delivery     | backlog, processing, hotels, inefficiency, cost, capacity, system, delivery                |
| economy_prosperity    | workforce, productivity, skills, growth, pressure on services, economy, jobs               |
| fairness_distribution | fair, fairness, distribution, equity, access, disadvantaged                              |
| stability_risk       | stability, risk, uncertainty, volatility, crisis                                         |
| …                    | (others as in taxonomy)                                                                 |

**Decision process**:

1. For each **subject** (e.g. small_boats), collect all **neighbourhoods** that contain at least one subject trigger.
2. For each neighbourhood, **score** it against every respect by counting **keyword_seed** matches (same logic as `lib/pipeline/classifier.ts`: token/phrase match in that stretch of text). This yields a suggested respect and strength per passage.
3. **Aggregate** across neighbourhoods (e.g. majority vote, or highest total score) to get a **candidate decisive respect** from keyword evidence alone.
4. **LLM step**: Pass to the LLM either (a) only the concatenated neighbourhoods for that subject, or (b) the full manifesto plus a clearly marked “Relevant excerpts for [subject]” section. The prompt explicitly lists **keyword_seeds per respect** so the LLM can map framing language to the same taxonomy. The LLM outputs the final **primary_respect** (and optionally secondary), **priority_rationale**, and **authoritative_sources** (pointing to passage/section).

So: **trigger keywords** find **where** the subject is discussed; **neighbourhood** defines **what text** to use; **taxonomy keyword_seeds** in that text drive both a heuristic suggestion and the LLM’s categorisation into **security/border**, **humanitarian**, **rule_of_law**, etc.

### 2.5 Output

- **Party position** per subject: `primary_respect` (taxonomy id), `secondary_respects`, `priority_rationale`, `authoritative_sources`.
- Optionally, **passage-level metadata**: which neighbourhoods were extracted, which trigger and which keyword_seeds matched, and the heuristic suggestion per passage (for transparency and debugging).

---

## 3. Implementation summary

- **`lib/pipeline/passage-extractor.ts`** (new):
  - **Subject trigger map**: subject_id → list of trigger phrases (migration, immigration, small boats, asylum, etc.).
  - **extractPassages(text, subjectId, options)**: find all trigger matches, expand to neighbourhood (sentence/paragraph ±N), merge overlaps, return list of `{ start, end, text, triggerMatched }`.
  - **scorePassageAgainstRespects(text)**: reuse taxonomy keyword_seeds to score a passage per respect (same idea as classifier); return ranked respects and matched keywords.
- **`lib/extract-prompts.ts`**:
  - Include **keyword_seeds** per respect in the system prompt so the LLM can align framing with taxonomy.
  - **buildExtractUserPrompt** optionally accepts **relevantExcerptsBySubject**: `Record<subjectId, string>`. If provided, the user prompt includes a “Relevant excerpts for [subject]” block (from neighbourhoods) in addition to or instead of raw full text for that part of the analysis.
- **`lib/extract-run.ts`**:
  - Before calling the LLM: for each subject, run the passage extractor; concatenate neighbourhood text per subject; optionally run keyword scoring and pass heuristic suggestion into the prompt or use it for validation.
  - Build user prompt with **relevantExcerptsBySubject** so that migration/immigration/small boats mentions are explicitly surfaced and the LLM focuses on them to form the decisive respect and categorise into the taxonomy labels above.

This gives you: **trigger-based location** (migration/immigration/small boats) → **neighbourhood extraction** → **keyword_seeds in that neighbourhood** → **categorisation** into security/border, humanitarian, etc., with the LLM making the final decisive-respect call using the same taxonomy and seeds.
