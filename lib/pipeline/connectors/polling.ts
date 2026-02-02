/**
 * Live polling / public signal connector. Stores SourceRef(role=polling_evidence|public_signal_proxy).
 * Prefer real polling feeds; fallback to structured pages. Map questions to respects.
 */

import type { RawPollItem } from "../types";
import type { SourceRef } from "../source-model";
import { createSourceRef, sourceId } from "../source-model";
import { validateRawPollItem } from "../validate-poll";

const RESPECT_MAP: { pattern: RegExp; respect_id: "security_border" | "humanitarian" | "rule_of_law" | "sovereignty_control" }[] = [
  { pattern: /tough|stop|deter|crackdown|reduce numbers|boats|border control/i, respect_id: "security_border" },
  { pattern: /humane|dignity|protect|refugee|safe route|compassion/i, respect_id: "humanitarian" },
  { pattern: /ECHR|HRA|legal|court|due process|law|convention/i, respect_id: "rule_of_law" },
  { pattern: /sovereignty|control|take back/i, respect_id: "sovereignty_control" },
];

/** UK pollster pages (real data; no public JSON API – we parse what we can). */
const POLL_SOURCES: { url: string; pollster: string }[] = [
  { url: "https://yougov.co.uk/topics/politics/articles", pollster: "YouGov" },
  { url: "https://www.opinium.com/political-polling/", pollster: "Opinium" },
  { url: "https://www.ipsos.com/en-uk", pollster: "Ipsos" },
];

/** Try to extract poll-like data from HTML (JSON-LD FAQPage or similar). Returns null if nothing found. */
function tryParsePollFromHtml(html: string, pollster: string, url: string, retrieved_at: string): Omit<RawPollItem, "id"> | null {
  const scriptMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (!scriptMatch) return null;
  for (const block of scriptMatch) {
    const inner = block.replace(/<script[^>]*>|<\/script>/gi, "").trim();
    try {
      const data = JSON.parse(inner);
      const one = Array.isArray(data) ? data[0] : data;
      if (one?.mainEntity?.name && Array.isArray(one.mainEntity?.acceptedAnswer)) {
        const name = String(one.mainEntity.name);
        const answers = one.mainEntity.acceptedAnswer as { text?: string; upvoteCount?: number }[];
        const total = answers.reduce((s, a) => s + (a.upvoteCount ?? 0), 0) || 1;
        const options = answers.map((a) => a.text ?? "").filter(Boolean);
        const results = total > 0 ? answers.map((a) => ((a.upvoteCount ?? 0) / total)) : answers.map(() => 1 / answers.length);
        if (options.length >= 2 && options.length === results.length) {
          return {
            pollster,
            question: name,
            options,
            results,
            fieldwork_dates: one.datePublished?.slice(0, 10) ?? retrieved_at.slice(0, 10),
            published_at: retrieved_at,
            url,
            sample_size: total > 0 && total < 1e7 ? Math.round(total) : undefined,
          };
        }
      }
    } catch {
      // not JSON or wrong shape
    }
  }
  return null;
}

export async function collectPolling(
  subjectId: string
): Promise<{ items: RawPollItem[]; sources: SourceRef[] }> {
  const items: RawPollItem[] = [];
  const sources: SourceRef[] = [];
  const retrieved_at = new Date().toISOString().slice(0, 19) + "Z";

  for (const { url, pollster } of POLL_SOURCES) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "DRCM-Sophist-Tool/1.0 (research)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const parsed = tryParsePollFromHtml(html, pollster, url, retrieved_at);
      if (!parsed) continue; // No structured poll in HTML; do not add fabricated data (see docs/DATA-FEEDS.md).
      const item: RawPollItem = { id: "", pollster: parsed.pollster, question: parsed.question, options: parsed.options, results: parsed.results, fieldwork_dates: parsed.fieldwork_dates, published_at: parsed.published_at, url: parsed.url, sample_size: parsed.sample_size };
      const validation = validateRawPollItem(item);
      if (!validation.valid) continue; // Skip malformed parsed data
      const srcId = sourceId("poll", `${pollster}_${Date.now()}`);
      item.id = srcId;
      const ref = createSourceRef(srcId, `${pollster}: ${parsed.question.slice(0, 60)}`, "poll", "polling_evidence", {
        publisher: pollster,
        url,
        retrieved_at,
      });
      sources.push(ref);
      items.push(item);
    } catch {
      // Skip on fetch error; real data only
    }
  }

  return { items, sources };
}

export { RESPECT_MAP };
