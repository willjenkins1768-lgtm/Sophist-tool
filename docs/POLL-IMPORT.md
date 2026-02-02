# How to import polls

Polling data is **manual/curated only**: the pipeline uses only polls you import. No live scraping.

---

## 1. Prepare your poll data

Each poll is one **question** with **options** and **result shares** (percentages as 0–1).

### Required fields

| Field | Type | Example |
|-------|------|--------|
| `pollster` | string | `"YouGov"` |
| `question` | string | Exact question text as asked |
| `options` | string[] | `["Support", "Oppose", "Don't know"]` |
| `results` | number[] | `[0.42, 0.45, 0.13]` (same order as options; must sum to 1) |
| `fieldwork_dates` | string | `"2025-01-03 to 2025-01-05"` or `"2025-01-06"` |
| `published_at` | string | ISO date, e.g. `"2025-01-06T10:00:00Z"` |

### Optional fields

| Field | Type | Example |
|-------|------|--------|
| `id` | string | Unique id (generated if omitted) |
| `url` | string | Link to release or methodology |
| `sample_size` | number | e.g. `1723` |

### Example: one poll

```json
{
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

### Example: JSON file (array of polls)

Save as e.g. `my-polls.json`:

```json
[
  {
    "pollster": "YouGov",
    "question": "Do you support or oppose the government's policy of sending some asylum seekers to Rwanda?",
    "options": ["Support", "Oppose", "Don't know"],
    "results": [0.42, 0.45, 0.13],
    "fieldwork_dates": "2025-01-03 to 2025-01-05",
    "published_at": "2025-01-06T10:00:00Z",
    "url": "https://yougov.co.uk/...",
    "sample_size": 1723
  },
  {
    "pollster": "Savanta",
    "question": "Should the UK prioritise border control or protecting refugees?",
    "options": ["Border control", "Protecting refugees", "Both equally"],
    "results": [0.52, 0.28, 0.2],
    "fieldwork_dates": "2025-01-10",
    "published_at": "2025-01-12T00:00:00Z",
    "sample_size": 2100
  }
]
```

**Rules:**

- `results` must be in the **same order** as `options`.
- `results` must **sum to 1** (within ~2% for rounding).
- Each value in `results` must be between 0 and 1 (e.g. 0.42 for 42%).

---

## 2. Import

### Option A: Import script (recommended)

From the project root:

```bash
node scripts/import-polls.js <path-to-your-polls.json>
```

Example:

```bash
node scripts/import-polls.js ./my-polls.json
```

- Reads the JSON array and **appends** each valid poll to `data/pipeline/small_boats/raw_polls.json`.
- Invalid rows are skipped and reported.
- You can run it multiple times with different files; new polls are added.

### Option B: Edit the storage file directly

1. Open or create `data/pipeline/small_boats/raw_polls.json`.
2. It must be a **JSON array**. Each element is a **stored record**:

```json
{
  "id": "id_1738...",
  "subject_id": "small_boats",
  "timestamp": "2025-02-02T12:00:00.000Z",
  "source": "import",
  "payload": {
    "id": "poll_yougov_20250106",
    "pollster": "YouGov",
    "question": "...",
    "options": ["Support", "Oppose", "Don't know"],
    "results": [0.42, 0.45, 0.13],
    "fieldwork_dates": "2025-01-03 to 2025-01-05",
    "published_at": "2025-01-06T10:00:00Z",
    "url": "https://...",
    "sample_size": 1723
  }
}
```

- `id`: unique record id (e.g. `id_` + timestamp + random).
- `subject_id`: `"small_boats"`.
- `timestamp`: ISO string when you added it.
- `source`: e.g. `"import"` or `"curated"`.
- `payload`: the poll object in the same shape as above (with `id` on the payload if you want a stable source id).

Append new objects to the array and save.

---

## 3. Refresh the view

After importing, run a refresh so the app uses the new polls:

- **Via UI:** trigger refresh from the Small boats subject view (if you have a refresh button).
- **Via script:**  
  `npm run refresh`  
  (with the dev server running on the default URL), or call your refresh API the same way you usually do.

The polling card will then show the imported polls and the question-level breakdown (question + options + percentages).

---

## 4. Where to get poll data

- **British Polling Council (BPC)** members: YouGov, Savanta, Opinium, Ipsos, etc. — look for “Migration”, “Small boats”, “Asylum”, “Rwanda” in their releases.
- **UK Polling Report / What UK Thinks** — summaries and links to questions/results.
- **News stories** that cite a pollster and percentages — you can add one poll per question from the article.

There is no single UK polling API; data is usually taken from PDFs, HTML tables, or release pages and entered manually or via your JSON file.
