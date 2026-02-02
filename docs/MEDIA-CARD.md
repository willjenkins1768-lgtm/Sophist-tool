# Media card: what is displayed and what data is used

When you open the Small boats subject and look at the **Media framing** card, here is what you see and where it comes from.

---

## What is displayed

1. **Header**
   - **"Media framing (last 14 days)"** — time window for the analysis.
   - **"As of [date/time]"** — when the view model was last refreshed.

2. **Dominant**
   - Up to four **political respects** (frames) with **percentages**, e.g.:
     - Security / Border control 45%
     - Humanitarian / Moral responsibility 25%
     - Rule of law / Legal process 15%
     - …
   - **Volume: N = X headlines** — total number of headlines in the window.

3. **Breakdown — respect distribution** (collapsible)
   - Same respect shares as above, shown as a list with chips and percentages.

4. **Media type split** (collapsible)
   - Table by **media type** (broadcast, broadsheet, tabloid, wire, online):
     - Count of headlines per type.
     - Respect shares **within** that type (e.g. “In broadcast, 50% security_border, 30% humanitarian …”).

5. **Top phrases** (collapsible)
   - Most frequent **words** (excluding stopwords) across all headline titles in the window.

6. **Exemplar headlines** (collapsible)
   - Up to 8 sample headlines with:
     - Title (in quotes)
     - Outlet (e.g. BBC, The Guardian)
     - Published date
     - Optional link
     - Assigned respect (frame) and confidence.

7. **Sources** (collapsible)
   - List of **source links** for all headlines that fed into the card (each headline is one source).

---

## What data is used

### 1. Raw media items (headlines)

The card is built from **raw media items**: each item is one headline (or one curated article) with:

- **outlet** (e.g. BBC, The Guardian, Sky News)
- **title**
- **lede** (short description, if present)
- **url**
- **published_at** (date/time)
- **media_type** (broadcast / broadsheet / tabloid / wire / online), inferred from outlet
- Optional **respect_id** (pre-labelled frame; if set, the classifier is skipped for that item)

**Where these items come from:**

- **RSS feeds (live)**  
  On each refresh, the app fetches UK RSS feeds and keeps only items whose **title + description** match the subject keywords.  
  - **Feeds used:** BBC (UK + politics), The Guardian (UK + politics), Sky News (UK + politics), Reuters, The Telegraph (news + politics), The Independent (UK + politics), Daily Mail (news), Daily Mirror (news).  
  - **Subject filter:** Only items that contain at least one of the **subject keywords** are kept. For Small boats, those keywords are defined in `lib/pipeline/subject-config.ts` (e.g. small boat, asylum, refugee, Rwanda, backlog, ECHR, legal challenge, court, deportation, etc.).  
  - **Time window:** Only items with `published_at` in the **last 14 days** are kept.  
  - **Deduplication:** By URL, or by title+outlet+date if there is no URL.

- **Stored (imported/curated) media**  
  Any items you have in **stored media** for the subject are merged in.  
  - **Source:** `data/pipeline/small_boats/raw_media.json` (or anything appended via `storage.appendRawMedia`).  
  - **Deduplication:** Same as above (by URL or title+outlet+date).  
  - So the **data used** for the media card is: **RSS items that match the subject + stored media**, merged and deduped.

### 2. Classification (which frame each headline gets)

Each headline is assigned **one** political respect (frame):

- If the item has a **pre-labelled `respect_id`** (curated import), that is used and the classifier is not run.
- Otherwise:
  - If **OPENAI_API_KEY** is set: a **batch LLM call** (e.g. gpt-4o-mini) assigns one respect per headline from the taxonomy.
  - If not: a **keyword classifier** assigns one respect using phrase matches from `lib/pipeline/taxonomy.ts` (e.g. “crackdown”, “refugee”, “ECHR”, “backlog”).

So the **data used** for “which frame” is: **title + lede** of each item, plus either your label or the LLM/keyword classifier.

### 3. Aggregation (what the card actually shows)

From the list of **raw media items** and their **classifications**:

- **Respect shares (dominant + breakdown):** For each respect, a **weighted sum** is computed (each headline weighted by recency and classification confidence), then normalised to **percentages**. Those are the numbers you see (e.g. 45% security_border, 25% humanitarian).
- **Volume:** Total number of headlines in the merged list (after dedupe).
- **Media type breakdown:** Same items are grouped by **media_type** (from outlet); within each type, the same weighted respect shares are computed.
- **Top phrases:** Word frequency over all **titles** (stopwords removed).
- **Exemplars:** A small set of **highest-weight** headlines (by recency × confidence), with their title, outlet, date, link, and assigned respect.
- **Sources:** The set of **source_ids** for every headline that was used (so every headline is one source in the list).

---

## Summary

| What you see on the card | Data used |
|--------------------------|-----------|
| “Media framing (last 14 days)”, “As of …” | Refresh time; 14-day window. |
| Dominant + percentages (e.g. Security 45%, Humanitarian 25%) | All raw media items (RSS + stored), each classified into one respect (pre-label, LLM, or keyword), then weighted by recency and confidence and normalised to shares. |
| Volume: N = X headlines | Count of merged, deduped headlines in the window. |
| Media type split | Same items, grouped by outlet type (broadcast/broadsheet/tabloid/wire/online); respect shares recomputed per type. |
| Top phrases | All headline **titles** in the set. |
| Exemplar headlines | Highest-weight headlines (title, outlet, date, link, respect from classification). |
| Sources | One source per headline (link to or citation for that headline). |

**Data sources for the raw items:**  
(1) **RSS:** UK feeds listed above, filtered by subject keywords in `subject-config.ts`, last 14 days, deduped.  
(2) **Stored media:** `data/pipeline/small_boats/raw_media.json` (and any appendRawMedia output), merged and deduped with RSS.

**To change what appears:**  
- Widen/narrow subject: edit **subject keywords** in `lib/pipeline/subject-config.ts`.  
- Add or correct specific headlines: add or edit items in **stored media** (or use appendRawMedia).  
- Improve frame accuracy: set **OPENAI_API_KEY** for LLM classification, or give items a **respect_id** when you import them.
