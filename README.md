# Sophist Tool — DRCM Analytical Tool

Analytical tool for the **Decisive Respect Contest Map (DRCM)**: political/discursive analysis based on Plato’s five kinds, applied to UK party manifestos and contested subjects.

**End users:** Political advisors, people in politics.  
**Core flow:** Open a conceptual map → click a subject node → see each party’s ontological position (decisive respect) and the currently dominant respect (typed and qualified) with evidence.

---

## Repo structure

| Path | Purpose |
|------|--------|
| `docs/DESIGN.md` | Design principles, conceptual fixes, LLM role separation, UI implications (integrated Cursor + ChatGPT thinking). |
| `schema/drcm-schema.json` | Tool-ingestible JSON schema/template: taxonomy, actors, subjects, party positions, dominant respects (typed), evidence, temporal metadata, human overrides. |

---

## Design principles (summary)

- **Never reify:** Every respect assignment is an assessment with provenance (who, when, evidence, status).
- **Dominance is typed:** Legal, incumbent, media, etc. — never a bare “dominant”; contestation and split dominance are representable.
- **Primary + secondary respect, confidence:** Per party per subject; avoids false rigidity.
- **Evidence verifiable:** Verbatim quotes + location (doc, offsets); negative capability (null when no clear respect).
- **Human-in-the-loop for dominance:** LLM proposes; human or rule decides; status = proposed | validated | contested | rejected.
- **Time first-class:** `as_of`, dominant_history, optional sampling windows for reproducibility.

See **`docs/DESIGN.md`** for full principles, schema field notes, and UI implications.

---

## Data flow (target)

1. **Input:** UK party manifestos (Labour, Conservative, Reform, Green) + optional policy/media snippets.
2. **LLM pipeline:** Extract party positions (primary/secondary respect, evidence, confidence) per subject; propose dominant respect with dominance_types and rationale; **do not** let LLM decide dominance end-to-end.
3. **Output:** JSON conforming to `schema/drcm-schema.json` (validated, optionally human-confirmed).
4. **Tool:** Ingest JSON → map (subject nodes, dominance halo) → subject detail (party cards, dominant typed, evidence, contestation).

---

## Running the tool

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app loads sample data from `public/data/drcm-sample.json`, shows a conceptual map of contested subjects, and on click displays each party’s ontological position and the currently enforced default (dominant respect) for that subject.

## LLM pipeline (Extract from manifesto)

1. Add your OpenAI API key: copy `.env.example` to `.env.local` and set `OPENAI_API_KEY=sk-...`.
2. In the app, click **Extract from manifesto** (or go to `/extract`).
3. Select party, select subjects, paste manifesto text, then **Run extraction**.
4. The API calls GPT-4o-mini with a fixed prompt (five respects, verbatim quotes only, null allowed). Results appear as party positions with evidence.
5. Click **Merge into map** to add them to the current data; the conceptual map updates.

Design: LLM **proposes** positions only; dominance is not automated (human/rule decides). Evidence is verbatim quotes; negative capability (no clear respect) is allowed.

## Next steps

- **Validation:** Quote verification; stricter schema validation.
- **Dominance proposal:** Optional API step to propose dominant respect from party positions + policy snippet.
- **Export:** PDF or slide-ready summary per subject.
