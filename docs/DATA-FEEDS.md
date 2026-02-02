# Data feeds: Media and polling cards

This document explains **why** the media and polling cards can show wrong or misleading data, and gives **concrete advice** on how to feed accurate information so you get:

- **Media card:** A real breakdown of how the media is engaging with the subject (outlets, frames, volume).
- **Polling card:** A clear breakdown of questions asked by pollsters and the actual answers (options + percentages) relevant to the subject.

---

## 1. Media card: How it works and why it can be wrong

### Current pipeline

1. **Collection** (`lib/pipeline/connectors/news.ts`): Fetches UK RSS feeds (BBC, Guardian, Sky, Reuters). Only items whose **title + description** contain hardcoded subject keywords (e.g. "small boat", "asylum", "Rwanda") are kept.
2. **Classification** (`lib/pipeline/classifier.ts`): Each headline is assigned **one** “respect” (security_border, humanitarian, rule_of_law, etc.) using **keyword matching** against `taxonomy.ts` seeds (e.g. "crackdown" → security_border, "refugee" → humanitarian).
3. **Aggregation** (`lib/pipeline/aggregators.ts`): Respect shares, media-type breakdown (broadcast/broadsheet/tabloid/wire), exemplar headlines, and top phrases are computed from classified items.

### Why the breakdown can be wrong

- **Keyword-only classification** is crude: one headline often touches several frames; the classifier picks a single respect from word overlap, so nuance and mixed framing are lost.
- **Subject filter** is narrow and fixed: only items matching `SMALL_BOATS_KEYWORDS` are included; other relevant angles (e.g. legal, capacity) may be under-represented if the wording doesn’t match.
- **RSS gives titles/snippets only**: no full article text, so “how the media is engaging” is inferred from headlines, not tone or body framing.
- **No weighting by outlet reach or prominence**: each item counts similarly; you may want to weight by outlet type or circulation.

### How to feed accurate information for the media card

**Goal:** Get a breakdown of **how the media is engaging** with the subject (which outlets, which frames, volume).

**Option A – Keep RSS but improve input**

1. **Subject keywords**  
   - Make keywords **configurable per subject** (e.g. in a config file or env), not hardcoded.  
   - Include legal/capacity terms if you care about those frames (e.g. "backlog", "ECHR", "court").

2. **Classification**  
   - Prefer **LLM-based classification** (e.g. one call per headline: “Which primary respect does this headline reflect?”) with the same respect taxonomy.  
   - Keep keyword classification as fallback when no API; expand seeds in `lib/pipeline/taxonomy.ts` for each respect so framing language is better covered.

3. **What to store per item**  
   - Keep: `outlet`, `media_type`, `title`, `lede`, `url`, `published_at`.  
   - Optional: allow a **manual or curated `respect_id`** when you have human-labelled exemplars so aggregates are not purely heuristic.

**Option B – Curated / manual media input**

- **Format:** One record per article/headline with: `outlet`, `media_type`, `title`, `lede`, `url`, `published_at`, and optionally `respect_id` (if you want to bypass the classifier).  
- **Feeding:** Use the same shape as `RawMediaItem` in `lib/pipeline/types.ts`. You can:
  - Append via `storage.appendRawMedia(subjectId, "curated", payload)` and re-run the pipeline (classifier will run unless you add a path that uses pre-set `respect_id`), or  
  - Add a small “Import media” flow (e.g. CSV or form) that writes into the same storage and then refresh.

**Option C – Richer “engagement” breakdown**

- **By outlet:** You already have `media_type_breakdown` (broadcast, broadsheet, tabloid, wire). Ensure `OUTLET_TO_MEDIA_TYPE` in `news.ts` and `aggregators.ts` is complete for every outlet you use.  
- **By frame (respect):** The main improvement is better classification (LLM or expanded seeds).  
- **Volume:** The card already shows “N = X headlines”; that’s accurate if the feed and subject filter are correct.  
- Optional: add **sentiment or tone** (e.g. “critical of government” vs “supportive”) as a separate field if you later add a source that provides it.

**Recommended immediate steps**

1. Make **subject keywords** configurable (e.g. `SUBJECT_KEYWORDS[subjectId]` in `news.ts`).  
2. Add **LLM-based classification** for media items when `OPENAI_API_KEY` is set (same pattern as party extraction); fall back to keyword classification otherwise.  
3. Document the **exact `RawMediaItem` shape** (see below) so you can import curated headlines from spreadsheets or other tools.

**RawMediaItem shape (for import/API)**

```ts
{
  id: string;           // e.g. sourceId("news", uniqueKey)
  outlet: string;      // e.g. "BBC", "The Guardian"
  media_type?: "broadcast" | "broadsheet" | "tabloid" | "online" | "wire";
  title: string;
  lede?: string;       // optional short description
  url?: string;
  published_at: string; // ISO date or datetime
  retrieved_at?: string;
}
```

---

## 2. Polling card: How it works and why it can be wrong

### Current pipeline

1. **Collection** (`lib/pipeline/connectors/polling.ts`): Fetches **pollster homepage HTML** (YouGov, Opinium, Ipsos). It looks for **JSON-LD `FAQPage`** in `<script type="application/ld+json">` and tries to treat `mainEntity.name` as the question and `mainEntity.acceptedAnswer` as options, with `upvoteCount` as the “count”.  
   - **Problem:** FAQPage is for **Q&A / FAQs**, not survey results. Pollster sites rarely expose real polls as FAQPage; “acceptedAnswer” + “upvoteCount” are for things like votes on answers, not “58% said Yes”. So the connector either finds **nothing** or **wrong** data.

2. **Fallback:** When no structured poll is found, the code **invents** a placeholder:  
   - Question: `"Migration / small boats (from {Pollster} – page retrieved; no structured poll in HTML)"`  
   - Options: `["Tougher measures", "More humane approach", "Other"]`  
   - Results: `[0.5, 0.4, 0.1]`  
   So the card often shows **fabricated** numbers, not real polls.

3. **Aggregation:** Real or placeholder polls are classified by keyword patterns on question + options, then respect shares are computed. The **question-level** table shows: pollster, fieldwork, question, **one** “mapped respect”, and **one** “result %” (the primary respect’s share). It does **not** show the full **options and their percentages** (e.g. “Yes 58%, No 35%, Don’t know 7%”).

### Why the breakdown is wrong or unclear

- **Data source:** Scraping pollster homepages for FAQPage does not reflect real polling data. Real polls are in press releases, tables, or data portals, not in FAQ schema.
- **Placeholder data:** Fake 50/40/10-type results are misleading.
- **UI:** Even when a real poll is stored (e.g. from mocks or future import), the question-level table only shows a single “Result” % and does not list each **question option and its percentage**.

### How to get accurate polling data to input

**Goal:** Clear breakdown of **questions asked** and **answers to those questions** (option + %) relevant to the subject.

**Reliable sources for UK migration / small boats polling**

1. **British Polling Council (BPC)**  
   - Members publish methodology and often link to releases.  
   - YouGov, Savanta, Opinium, Ipsos, etc. often publish tables or PDFs with question text and percentages.  
   - Use: “Small boats”, “illegal migration”, “asylum”, “Rwanda” on their sites or via Google site search.

2. **UK Polling Report / What UK Thinks**  
   - Curated summaries and sometimes links to full questions and results.  
   - Good for finding exact question wording and dates.

3. **Pollster websites**  
   - YouGov: “Politics” or “Society” sections; look for “Migration” or “Small boats” releases.  
   - Savanta, Opinium, Ipsos: search for “migration” or “asylum” in news/press releases.  
   - Often the only machine-readable format is **PDF or HTML tables**; you may need to copy-paste or use a small scraper for specific release pages (not the homepage).

4. **News articles**  
   - Stories that say “a new poll shows X% support …” usually cite the pollster and sometimes the exact question. You can manually add those as one poll per question.

**No widespread public API:** There is no single UK polling API. Data is typically:  
- Manually copied from PDFs/HTML tables, or  
- Scraped from **specific** release URLs (not homepage), or  
- Sourced from a paid aggregator (if you have one).

### Input format for polling data

The pipeline expects **RawPollItem** (see `lib/pipeline/types.ts`). Each poll = one question with multiple options and their shares.

**RawPollItem shape**

```ts
{
  id: string;              // unique id, e.g. sourceId("poll", "yougov_20250102_1")
  pollster: string;       // e.g. "YouGov", "Savanta"
  question: string;       // exact question text as asked
  options: string[];      // e.g. ["Support tougher measures", "Oppose", "Don't know"]
  results: number[];      // share per option, same order, 0–1 (e.g. 0.58, 0.35, 0.07)
  fieldwork_dates: string; // e.g. "2025-01-05 to 2025-01-07" or "2025-01-06"
  published_at: string;   // ISO date when results were published
  url?: string;          // link to release or methodology
  sample_size?: number;   // e.g. 1723
}
```

**Example (real-shaped) poll**

```json
{
  "id": "poll_yougov_smallboats_20250106",
  "pollster": "YouGov",
  "question": "Do you support or oppose the government's policy of sending some asylum seekers to Rwanda?",
  "options": ["Support", "Oppose", "Don't know"],
  "results": [0.42, 0.45, 0.13],
  "fieldwork_dates": "2025-01-03 to 2025-01-05",
  "published_at": "2025-01-06T10:00:00Z",
  "url": "https://yougov.co.uk/...",
  "sample_size": 1723
}
```

**How to feed it** — See **[docs/POLL-IMPORT.md](./POLL-IMPORT.md)** for step-by-step import instructions.

1. **Import script (recommended)**  
   - Run: `node scripts/import-polls.js <path-to-polls.json>` (or `npm run import-polls -- ./my-polls.json`). The JSON file must be an array of poll objects (see POLL-IMPORT.md).  
   - Or append to `data/pipeline/small_boats/raw_polls.json` in the same format as existing stored polls (see `StoredRawPoll`: `id`, `subject_id`, `timestamp`, `source`, `payload` where `payload` is `RawPollItem`).

2. **Stored poll file format**  
   Each line/record in the append-only store looks like:

   ```json
   {
     "id": "id_1738...",
     "subject_id": "small_boats",
     "timestamp": "2025-02-02T12:00:00.000Z",
     "source": "import",
     "payload": { ... RawPollItem ... }
   }
   ```

3. **Disable or remove placeholder polls**  
   In `lib/pipeline/connectors/polling.ts`, when `tryParsePollFromHtml` returns null, **do not** push the fake poll (the block that sets `question: "Migration / small boats (from ${pollster} – page retrieved; no structured poll in HTML)"` and `results: [0.5, 0.4, 0.1]`). Either push nothing or push a clear “No data” placeholder so the UI does not show fabricated numbers.

### Clear breakdown in the UI: questions and answers

- **Question-level table:** For each poll, show **question**, **pollster**, **fieldwork**, **sample size**, **link**, and — importantly — **each option and its percentage** (e.g. “Support 42%”, “Oppose 45%”, “Don’t know 13%”), not just one “Result” %.  
- The pipeline already has `options` and `results` on `RawPollItem`; the view model’s `question_level` currently only exposes a single `result_pct` and `mapped_respect`.  
- **Recommendation:** Extend `PollQuestion` (or the payload used by the polling card) to include `options` and `results` (or `option_results: { option: string; pct: number }[]`) and render them in the “Question-level breakdown” table so users see the actual questions and answers. See the code changes below for a concrete implementation.

---

## 3. Summary

| Card    | What’s wrong today                         | How to get accurate data |
|---------|--------------------------------------------|---------------------------|
| **Media**   | Keyword-only classification; narrow subject filter; RSS titles only | Configurable keywords; LLM or better keyword classification; optional curated `RawMediaItem` import. |
| **Polling** | Homepage scraping for FAQPage (not real polls); placeholder fake data; UI shows only one “result” % per question | Use BPC/pollster releases or news; input `RawPollItem` via import or file; remove placeholder; show options + % in UI. |

**Media:** Improve classification and subject keywords; optionally allow curated media import in `RawMediaItem` format.  
**Polling:** Stop using fabricated fallback; feed real polls in `RawPollItem` form from BPC/pollster releases or manual entry; extend the polling card UI to show per-question **options and their percentages**.

---

## 4. Recommendations: accuracy and completeness

Prioritised list of changes to make media and polling data **as accurate and complete as possible**. Order is by impact and dependency (do earlier items first where possible).

### Tier 1 – Foundation (do first)

| # | Recommendation | Why | Effort |
|---|----------------|-----|--------|
| 1 | **Make subject keywords configurable per subject** | Today only `SMALL_BOATS_KEYWORDS` are used; other subjects or angles (legal, capacity) are missed. Add e.g. `SUBJECT_KEYWORDS[subjectId]` in `news.ts` (and optionally a small config file or env) so you can tune coverage per subject and add terms like "backlog", "ECHR", "court". | Low |
| 2 | **Establish a single source of truth for polling** | The live connector cannot reliably get real polls from homepage HTML. Decide: (a) **manual/curated only** – you add polls via CSV/JSON/script using `RawPollItem` and `storage.appendRawPoll`; or (b) **scheduled manual + optional scraper** – you periodically add polls from BPC/pollster releases, and optionally add a scraper for *specific* release URLs (not homepages). Either way, document the process and who is responsible for updates. | Low (process) / Medium (scraper) |
| 3 | **Validate and normalise imported polls** | When ingesting polls (manual or script), validate: `options.length === results.length`, `results` sum to ~1, `fieldwork_dates` and `published_at` are parseable, `sample_size` is a positive integer if present. Reject or flag invalid rows so the card never shows inconsistent percentages. | Low |
| 4 | **Widen RSS coverage for media** | Add more UK feeds so the media card is more complete: e.g. Telegraph, Times, Independent, Daily Mail, Mirror (politics/UK sections). Update `UK_RSS_FEEDS` in `news.ts` and `OUTLET_TO_MEDIA_TYPE` so every new outlet has a media type. More feeds = more items passing the subject filter = more representative framing. | Low |

### Tier 2 – Classification and quality

| # | Recommendation | Why | Effort |
|---|----------------|-----|--------|
| 5 | **Use LLM-based classification for media when available** | Keyword-only classification is the main cause of wrong “respect” breakdowns. Add an optional path: when `OPENAI_API_KEY` is set, call the LLM once per headline (or batched) with a prompt like: “Given this headline and lede, which single political respect (from list) is the primary frame?” Use the same taxonomy as party extraction. Fall back to the current keyword classifier when no API. This significantly improves accuracy of the media framing shares. | Medium |
| 6 | **Expand keyword seeds for media fallback** | If you keep keyword classification as fallback, expand `keyword_seeds` in `lib/pipeline/taxonomy.ts` for each respect with real headline phrasing (e.g. “stop the boats”, “safe routes”, “legal challenge”, “backlog crisis”). More seeds = fewer items defaulting to `security_border` and better spread across respects. | Low |
| 7 | **Optional: allow pre-labelled media** | For curated imports, support an optional `respect_id` on each `RawMediaItem`. When present, skip the classifier for that item and use the label in aggregation. Lets experts or editors fix misclassifications and improves accuracy for high-value items. | Low |

### Tier 3 – Completeness and process

| # | Recommendation | Why | Effort |
|---|----------------|-----|--------|
| 8 | **Add a simple poll import flow** | To keep polling complete, add a minimal “Import polls” path: e.g. CSV upload or form (pollster, question, option1, pct1, option2, pct2, … fieldwork, url, N) that converts to `RawPollItem[]`, calls `storage.appendRawPoll(subjectId, "import", item)` and triggers a refresh. Reduces friction so new polls are added regularly. | Medium |
| 9 | **Add a simple media import (optional)** | Similarly, a CSV or form for media (outlet, title, lede, url, published_at, optional respect_id) that appends via `storage.appendRawMedia` and refreshes. Useful for adding high-impact stories the RSS filter missed or for outlets without RSS. | Medium |
| 10 | **Deduplicate media by URL and time window** | When combining RSS + imports, dedupe by URL (and optionally title+outlet+date) so the same story does not count twice. The connector already dedupes within a run; ensure the refresh path merges stored media with newly fetched and dedupes before classification. | Low |
| 11 | **Record and show “as of” and source** | You already have `staleness` (media_updated_at, polling_updated_at). In the UI, show “Media as of …” and “Polling as of …” and, in sources, whether each item came from “RSS”, “import”, or “curated”. Helps users judge recency and provenance. | Low |

### Tier 4 – Higher fidelity (optional)

| # | Recommendation | Why | Effort |
|---|----------------|-----|--------|
| 12 | **Scrape specific pollster release URLs** | If you have a list of known URLs for BPC member releases (e.g. a YouGov “small boats” release page), write a small scraper that extracts question, options, and percentages from that page’s HTML/PDF and outputs `RawPollItem`. Only scrape pages that actually contain poll tables; do not rely on homepage FAQ schema. | Medium–High |
| 13 | **Full-text or lede for media** | For “how the media is engaging”, headline-only is limited. If you have access to article text or longer ledes (e.g. via an API or scraper), store a longer `lede` or `body_snippet` and run classification on that for better frame detection. | Medium |
| 14 | **Weight media by outlet or reach** | Optionally weight items by outlet type or circulation when computing respect shares, so high-reach outlets do not dominate purely by volume. Requires a small weighting map and a change in the aggregator. | Low |

### Summary checklist

- **Accuracy:** Configurable subject keywords (1); LLM classification for media (5); expanded keyword seeds (6); validated poll import (3); no fabricated polls (already done).
- **Completeness:** More RSS feeds (4); single process for polling (2); poll import flow (8); optional media import (9); dedupe (10).
- **Transparency:** “As of” and source labels (11); optional pre-labelled media (7).

Implementing **Tier 1** and **Tier 2** gives the largest gain in accuracy and completeness with reasonable effort; Tier 3 and 4 refine process and fidelity.
