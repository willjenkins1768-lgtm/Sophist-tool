# DRCM Tool: Design Principles & Integrated Thinking

This document integrates our prior design (map → subject → contest drill-down, evidence-first, JSON-first) with refinements from the ChatGPT critique. The goal: **preserve the theory of contested intelligibility without silently reifying dominance or flattening ontology.**

---

## 1. Design principles (baked into schema and UI)

### A. Never reify: everything is an assessment with provenance

- Every respect assignment (party position, dominant respect) is an **assessment**, not a fact.
- Each assessment carries: **who/what produced it** (LLM, rule, human), **when**, **evidence**, **confidence**, **rationale**, **validation status**.
- The tool surfaces "proposed" vs "validated" so advisors know what is confirmed vs inferred.

### B. Dominance is typed and contingent, not absolute

- **"Dominant" is never a bare label.** It is always qualified:
  - **Legally entrenched** — primary legislation / statute frames the subject.
  - **Incumbent agenda-setting** — government in power sets the narrative.
  - **Administratively operationalised** — metrics, targets, procedures encode a respect.
  - **Discursively dominant (media / parliament)** — dominant frame in sampled discourse.
  - **Curated (expert)** — human-assigned with citation.
- Dominance can be **split** (e.g. law says X, media says Y) or **contested**; the schema and UI must represent that.
- Wording in UI: *"The currently enforced default that structures intelligibility"* — not *"The true frame."*

### C. Subject decomposition is supported (optional in v1)

- Subjects are **not atomic**. "Migration" is already carved by respects: border control, labour supply, asylum adjudication, security risk, humanitarian obligation.
- Schema supports: `parent_id`, children, scope notes.
- v1: decomposition can be **hidden by default**, **manually curated**, or **revealed when conflicts are incoherent** at the coarse level.
- Prevents overstating disagreement and conflating sub-subject respect shifts.

### D. Party position: primary + secondary, with confidence

- A single decisive respect per party per subject is **operationally necessary** but **ontologically lossy** (flattens internal contradiction, strategic ambiguity).
- Schema stores: **primary_respect**, **secondary_respect** (optional), **confidence**.
- UI can show primary only at first; secondary and confidence available on expand or in exports. Prevents false rigidity.

### E. Evidence is verifiable and grounded

- Evidence objects: **verbatim quote**, **doc_id**, **char_start / char_end** (or section/page), **quote_verified** boolean, **extracted_by**.
- **Negative capability:** the model must be allowed to return *"No clear decisive respect found"* and explain why. Absence of evidence is representable (null + reason).
- Instructions: *"If the text does not clearly privilege one respect, return null and explain why."* Avoids false precision and hallucinated quotes.

### F. Time is first-class

- Every assessment has: **as_of**, **timestamp**, optional **time window** (for media/Hansard samples).
- Dominant respect can have **dominant_history**: "Dominant since 2014" or per-period snapshots.
- Enables: ontology shift detection, respect displacement analysis, reproducibility of "as of" state.

### G. Human-in-the-loop for dominance

- **LLM proposes** candidate dominant respect(s) with rationale and sources.
- **Human or rule decides** final dominance (or marks "contested" / "split dominance").
- Schema: **human_override** on party positions and dominant respects; **status**: proposed | validated | contested | rejected.
- v1: **do not fully automate** dominance; require at least one authoritative anchor (statute, strategy, metric) and allow human confirmation/override.

### H. Ontological vs strategic disagreement

- Not all disagreement is ontological (different respects). Some is **same respect, different policy**.
- Schema/UI: simple flag where useful — *"Same respect, different policy"* vs *"Different respect (ontological contest)"*.
- Stops over-interpretation of every conflict as a kind-conflict.

---

## 2. Conceptual fixes summarised

| Issue | Fix |
|-------|-----|
| Reifying "dominant respect" | Dominance is typed (legal, incumbent, media, etc.); always qualified; "institutionally dominant" not "the true frame". |
| Subject as atomic | Subject decomposition (parent_id, children); optional in v1. |
| Single respect per party | Primary + secondary respect; confidence score; store even if UI shows primary only. |
| Evidence hallucination | Verbatim quotes + location (doc, offsets); quote_verified; allow null "no clear respect". |
| Dominance overconfidence | LLM proposes only; human/rule decides; surface "contested", "split dominance". |
| Static tool | Timestamps, as_of, dominant_history; optional "since" and snapshots. |
| All disagreement = ontological | Flag: same respect / different policy vs different respect (ontological contest). |

---

## 3. LLM role separation

| Role | LLM? | Notes |
|------|------|--------|
| Extract candidate respects (from text) | ✅ | With confidence; may return null. |
| Extract verbatim evidence (quotes + location) | ✅ | Must cite actual text; no fabrication. |
| Propose dominant respect | ⚠️ Suggest only | With dominance_types, sources, rationale. |
| Decide dominance | ❌ | Human or rule-based (e.g. weighted vote with min_confidence). |
| Validate consistency | ❌ | Deterministic code (taxonomy checks, schema validation). |

If the LLM decides dominance end-to-end, we lose the distinction we are trying to surface (enforced default vs challenger).

---

## 4. UI implications (minimal changes)

- **Map:** Subject nodes; halo/border colour = dominant respect (from assessments); tooltip = dominance_types + contestation level. If subject has children, optional expand or "see sub-subjects".
- **Subject detail header:**  
  *"Dominant (legal + incumbent): Change — confidence 0.62 — contestation: medium"*  
  Not: *"Dominant respect: Change"* alone.
- **"Why dominant" expandable:** Render dominance_types with weights and source notes (e.g. "Statutory framing emphasises deterrence (legal, 0.45)").
- **Party cards (ontological framing):** "Party X frames [Subject] **in respect of** [Respect]"; optional **key assertion** (subject is predicate in respect of X); **permissible predicates** (what this respect opens); **excluded predicates** (what this respect closes / structurally excludes); **rival respects** (answerable to competing respects); **legitimacy / stress-test** (if decisive respect diverges from lived reality, rival respects may gain legitimacy). Primary respect + "Matches dominant" / "Challenges dominant"; evidence as verbatim quotes.
- **Evidence:** Show quote + doc + section; "Quote verified" badge when true; link to source if available.
- **Status badges:** "Proposed" vs "Validated" so advisors see what is confirmed.
- **Optional:** "Same respect, different policy" vs "Ontological contest" per party pair on that subject.

---

## 5. Data windows (reproducibility)

- For media/Hansard dominance, sampling periods must be fixed and stored.
- Schema: optional **windows** object, e.g. `media_sample_window: { from, to }`.
- Prevents "dominant" drifting silently when new data is added.

---

## 6. Schema field notes (key additions from ChatGPT integration)

| Area | What changed | Why |
|------|----------------|-----|
| **Dominant respect** | `dominance_types[]` with `type_id`, `weight`, `sources[]` | Dominance is typed (legal/incumbent/media etc.), not a bare label; avoids reification. |
| **Dominant respect** | `contestation.level`, `contestation.challengers`, `contestation.split_dominance`, `contestation.alternative_dominants` | Contest pressure is explicit; "dominant" does not imply uncontested. |
| **Party position** | `primary_respect` + `secondary_respect`, `confidence` | Avoids flattening; supports layered framing and uncertainty. |
| **Party position** | `operator_signature` (per-respect scores) | Structural sanity check: if label is "change" but text has no change signature, flag. |
| **Assessments** | `status`: proposed \| validated \| contested \| rejected | UI can show "Proposed by model; not yet validated." |
| **Evidence** | `char_start`, `char_end`, `section`, `page`, `quote_verified`, `extracted_by` | Verifiable; reduces hallucination; advisors can check. |
| **Dominant** | `human_override` on party_positions and dominant_respects | Human-in-the-loop; v1 can curate without hacks. |
| **Time** | `as_of`, `dominant_history[]` with `from`/`to` | Temporal drift; ontology shift detection later. |
| **Subjects** | `parent_id`, optional children, `description` | Subject decomposition (Migration → Small boats, etc.). |
| **Windows** | `windows.media_sample_window`, etc. | Reproducible sampling periods for discourse dominance. |
| **Disagreement** | Optional `disagreement_type`: ontological vs same_respect_different_policy | Stops over-interpreting all disagreement as kind-conflict. |
| **Party position** | Optional `key_assertion`, `permissible_predicates[]`, `excluded_predicates[]` | Surfaces subject–predicate–respect and predicate-space (what can/cannot be said in this frame); supports dialectic: clarify chosen respect, de-prioritise others, stress-test against lived reality. |

---

## 7. Two-layer ontology (operators hidden, political respects visible)

**Level A — Hidden / analytical layer:** Ontological operators (Same, Different, Change, Rest, Being). Used for validation, extraction, scoring, and error detection. Not shown to analysts by default.

**Level B — Visible / political layer:** Domain-specific decisive respects that political actors actually argue over (e.g. Security / Border control, Humanitarian / Moral responsibility, Legal–Procedural, Economic / Labour market, Sovereignty / Democratic control, Administrative capacity). Each political respect has: id, label, guiding_question, typical_predicates, operator_signature (mapping to operators), domain.

**Rule:** Analysts see political respects. The system internally maps those respects onto ontological operators. The UI never surfaces “Dynamic / processual” or “Identity / continuity”; it shows “Security / Border control” and “Humanitarian protection”.

**Per-domain political respects:** Migration has its own set (6 respects). NHS, Climate, Economy can have separate sets. Subject has optional `domain`; political_respects are filtered by domain.

**Respect equivalence:** When two or more parties share the same primary political respect despite different rhetoric, the tool surfaces: “Despite rhetorical differences, [Party A] and [Party B] both treat [Respect] as ontologically prior.”

---

## 8. Three-layer instrument (ontology / power / reality)

The tool is a **three-layer instrument**:

- **Ontology layer:** What respect each party treats as prior (ought / interpretive stance).
- **Power layer:** Which respect is currently dominant in public discourse / institutions (media, incumbent, legal, public polls); who/what stabilises it; stability and drift.
- **Reality layer:** Events + metrics that stress-test whether a respect can hold; how each respect reads the same data.

**Unit of analysis per subject:** Dominant respect (now) + who/what stabilises it; party respects (stance); media frame; public respect (polls); reality signals. Cards are stacked by type (subject header → party cards → media → public → reality → choke-points → scenarios), not “one card per party only.”

**Party cards are analyst-forward:** Compact, comparable; stance (primary/secondary + what this respect demands); evidence (1–3 snippets + quality); **alignment panel** (Public fit ✅⚠️❌, Media fit, Reality fit, with hover reason); **contest posture** (relation to dominant: Matches/Challenges/Reframes; attack line if challenger; vulnerability if dominant-aligned); **commitments** (2–3 bullets: “If this respect is prior, then…”). Chips: “Dominant now: X” / “This party: Y” / “CHALLENGER”. Split stance (e.g. Labour) shown as Primary + Secondary + stance_mode: coalition / balancing, not “inconsistent.”

**Time window:** Selectable (7 / 30 / 90 days) above cards; updates dominance header, media card, polling card, reality trends when data is time-scoped.

**New card types:** Subject header (dominant + challengers + stability + recent drift); Party ontology cards (redesigned); Media frame card; Public/polling card; Reality metrics card (stress-test: same metric, interpretation by respect); Institutional choke-points; What would change dominance (scenarios).

---

## 9. Ontological card framing (from user brief)

- **True political conflict** is over determining which *respect* is decisive — not over facts or policies per se. Each respect opens certain predicates and closes others; the decisive respect structures what counts as intelligible. Assertions in other respects are often labelled wrong or "lack political meaning."
- **Subject–predicate–respect:** Cards can show a key assertion of the form "A [subject] is [predicate] in respect of [respect]."
- **Permissible vs excluded predicates:** "This respect opens: X · Y · Z" and "This respect closes: A · B" make the predicate-space explicit.
- **Rival respects / dialectic:** Each position is "answerable to competing respects" that wish to replace it; standing by the chosen respect means being stress-tested by rivals. If the decisive respect diverges from lived reality, it loses legitimacy and rival respects may gain ground.
- **Legitimacy:** The respect and predicate that track lived practice most closely have the highest chance of becoming legitimately prior. The UI surfaces this as a one-line stress-test reminder on each card and on the dominant-respect block.

---

## 10. Files in this repo

- **`schema/drcm-schema.json`** — Tool-ingestible JSON template implementing the above (parties: Labour, Conservative, Reform, Green; example subjects and assessments).
- **`docs/DESIGN.md`** — This document (design principles + integrated thinking).

Next steps: extend LLM extraction to populate `key_assertion`, `permissible_predicates`, `excluded_predicates` where possible; validation; export.
