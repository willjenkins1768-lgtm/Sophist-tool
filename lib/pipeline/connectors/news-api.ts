/**
 * News API (NewsAPI.org) connector: search UK-relevant articles by subject over a time window.
 * Use when NEWS_API_KEY is set for more accurate, subject-focused media framing (e.g. 3 months).
 * API docs: https://newsapi.org/docs/endpoints/everything
 */

import type { RawMediaItem, MediaType } from "../types";
import type { SourceRef } from "../source-model";
import { createSourceRef, sourceId } from "../source-model";
import { getSubjectSearchQuery } from "../subject-config";
import { OUTLET_TO_MEDIA_TYPE } from "./news";

const NEWS_API_BASE = "https://newsapi.org/v2";
/** Free/developer plan only allows articles from this date onward. Cap 'from' so requests succeed. */
const NEWS_API_MIN_FROM = new Date("2026-01-01T00:00:00Z");

/** Map NewsAPI source names to our outlet labels and media types. */
function normalizeOutlet(sourceName: string): string {
  const n = sourceName?.trim() || "Unknown";
  const lower = n.toLowerCase();
  if (lower.includes("guardian")) return "The Guardian";
  if (lower.includes("bbc") || lower.includes("bbc news")) return "BBC";
  if (lower.includes("telegraph")) return "The Telegraph";
  if (lower.includes("independent")) return "The Independent";
  if (lower.includes("sky")) return "Sky News";
  if (lower.includes("reuters")) return "Reuters";
  if (lower.includes("mail") && !lower.includes("daily")) return "Daily Mail";
  if (lower.includes("daily mail") || lower.includes("dailymail")) return "Daily Mail";
  if (lower.includes("mirror")) return "Daily Mirror";
  if (lower.includes("sun") && !lower.includes("sky")) return "The Sun";
  if (lower.includes("express")) return "Express";
  if (lower.includes("times")) return "The Times";
  if (lower.includes("financial times") || lower === "ft") return "Financial Times";
  return n;
}

function getMediaType(outlet: string): MediaType {
  const normalized = outlet.trim();
  return (
    OUTLET_TO_MEDIA_TYPE[normalized] ??
    OUTLET_TO_MEDIA_TYPE[normalized.replace(/^The\s+/i, "")] ??
    "online"
  );
}

export interface NewsApiArticle {
  source?: { id?: string; name?: string };
  author?: string;
  title?: string;
  description?: string;
  url?: string;
  publishedAt?: string;
  content?: string;
}

export interface NewsApiEverythingResponse {
  status?: string;
  totalResults?: number;
  articles?: NewsApiArticle[];
}

/**
 * Fetch articles from News API (everything endpoint) for the subject and window.
 * Requires NEWS_API_KEY in env. Returns items + sources for pipeline.
 */
export async function collectNewsFromApi(
  subjectId: string,
  windowDays: number = 90
): Promise<{ items: RawMediaItem[]; sources: SourceRef[] }> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey?.trim()) {
    return { items: [], sources: [] };
  }

  const to = new Date();
  let from = new Date();
  from.setDate(from.getDate() - windowDays);
  // Free plan only allows from NEWS_API_MIN_FROM onward
  if (from < NEWS_API_MIN_FROM) from = NEWS_API_MIN_FROM;
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);
  const q = getSubjectSearchQuery(subjectId);
  const params = new URLSearchParams({
    q,
    from: fromStr,
    to: toStr,
    language: "en",
    sortBy: "publishedAt",
    pageSize: "100",
    apiKey: apiKey.trim(),
  });

  const url = `${NEWS_API_BASE}/everything?${params.toString()}`;
  const items: RawMediaItem[] = [];
  const sources: SourceRef[] = [];
  const seen = new Set<string>();
  const retrieved_at = new Date().toISOString().slice(0, 19) + "Z";

  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
    console.log("[news-api] calling News API: q =", q, ", from", fromStr, "to", toStr);
  }

  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
        console.warn("[news-api] News API request failed:", res.status, body.slice(0, 200));
      }
      return { items, sources };
    }
    const data = (await res.json()) as NewsApiEverythingResponse;
    if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
      console.log("[news-api] News API response: status =", data.status, ", totalResults =", data.totalResults, ", articles =", data.articles?.length ?? 0);
    }
    if (data.status !== "ok" || !Array.isArray(data.articles)) {
      return { items, sources };
    }

    for (let i = 0; i < data.articles.length; i++) {
      const a = data.articles[i];
      const title = (a.title ?? "").trim();
      if (!title) continue;
      const outlet = normalizeOutlet(a.source?.name ?? "Unknown");
      const url = (a.url ?? "").trim();
      const publishedAt = a.publishedAt ?? new Date().toISOString();
      const dedupeKey = url && url.startsWith("http")
        ? url
        : (title + outlet + publishedAt.slice(0, 10)).toLowerCase().replace(/\s+/g, " ");
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const id = `news_api_${Date.now()}_${i}`;
      const srcId = sourceId("news", id);
      const ref = createSourceRef(srcId, title.slice(0, 80), "news_headline", "media_framing", {
        publisher: outlet,
        published_at: publishedAt.slice(0, 10),
        url: url || undefined,
        retrieved_at,
      });
      sources.push(ref);
      const lede = (a.description ?? a.content ?? "").slice(0, 300).trim() || undefined;
      items.push({
        id: srcId,
        outlet,
        media_type: getMediaType(outlet),
        title,
        lede,
        url: url || undefined,
        published_at: publishedAt,
        retrieved_at,
      });
    }
  } catch (err) {
    if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
      console.warn("[news-api] News API fetch error:", err instanceof Error ? err.message : err);
    }
  }

  return { items, sources };
}
