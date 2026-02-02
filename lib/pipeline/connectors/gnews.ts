/**
 * GNews API connector: search articles by subject with UK targeting.
 * Use when GNEWS_API_KEY is set for broad source coverage.
 * API docs: https://gnews.io/docs/v4
 */

import type { RawMediaItem, MediaType } from "../types";
import type { SourceRef } from "../source-model";
import { createSourceRef, sourceId } from "../source-model";
import { getSubjectSearchQuery } from "../subject-config";
import { OUTLET_TO_MEDIA_TYPE } from "./news";

const GNEWS_BASE = "https://gnews.io/api/v4";

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

export interface GNewsArticle {
  id?: string;
  title?: string;
  description?: string;
  content?: string;
  url?: string;
  image?: string;
  publishedAt?: string;
  lang?: string;
  source?: { id?: string; name?: string; url?: string; country?: string };
}

export interface GNewsSearchResponse {
  totalArticles?: number;
  articles?: GNewsArticle[];
}

/**
 * Fetch articles from GNews (search endpoint) for the subject and window.
 * Requires GNEWS_API_KEY in env. Returns items + sources for pipeline.
 */
export async function collectGNewsFromApi(
  subjectId: string,
  windowDays: number = 90
): Promise<{ items: RawMediaItem[]; sources: SourceRef[] }> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey?.trim()) {
    return { items: [], sources: [] };
  }

  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - windowDays);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);
  const q = getSubjectSearchQuery(subjectId);
  const params = new URLSearchParams({
    apikey: apiKey.trim(),
    q,
    lang: "en",
    country: "gb",
    max: "100",
    from: fromStr,
    to: toStr,
  });

  const url = `${GNEWS_BASE}/search?${params.toString()}`;
  const items: RawMediaItem[] = [];
  const sources: SourceRef[] = [];
  const seen = new Set<string>();
  const retrieved_at = new Date().toISOString().slice(0, 19) + "Z";

  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
    console.log("[gnews] calling GNews API: q =", q, ", from", fromStr, "to", toStr);
  }

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
        console.warn("[gnews] GNews API request failed:", res.status, body.slice(0, 200));
      }
      return { items, sources };
    }
    const data = (await res.json()) as GNewsSearchResponse;
    if (!Array.isArray(data.articles)) {
      return { items, sources };
    }
    if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
      console.log("[gnews] GNews API response: totalArticles =", data.totalArticles, ", articles =", data.articles.length);
    }

    for (let i = 0; i < data.articles.length; i++) {
      const a = data.articles[i];
      const title = (a.title ?? "").trim();
      if (!title) continue;
      const outlet = normalizeOutlet(a.source?.name ?? "Unknown");
      const articleUrl = (a.url ?? "").trim();
      const publishedAt = a.publishedAt ?? new Date().toISOString();
      const dedupeKey =
        articleUrl && articleUrl.startsWith("http")
          ? articleUrl
          : (title + outlet + publishedAt.slice(0, 10)).toLowerCase().replace(/\s+/g, " ");
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const id = `gnews_${Date.now()}_${i}`;
      const srcId = sourceId("news", id);
      const ref = createSourceRef(srcId, title.slice(0, 80), "news_headline", "media_framing", {
        publisher: outlet,
        published_at: publishedAt.slice(0, 10),
        url: articleUrl || undefined,
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
        url: articleUrl || undefined,
        published_at: publishedAt,
        retrieved_at,
      });
    }
  } catch (err) {
    if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
      console.warn("[gnews] GNews API fetch error:", err instanceof Error ? err.message : err);
    }
  }

  return { items, sources };
}
