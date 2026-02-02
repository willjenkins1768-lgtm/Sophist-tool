/**
 * Guardian Open Platform connector: search Guardian articles by subject over a time window.
 * Use when GUARDIAN_API_KEY is set for UK broadsheet coverage.
 * API docs: https://open-platform.theguardian.com/documentation/search
 */

import type { RawMediaItem, MediaType } from "../types";
import type { SourceRef } from "../source-model";
import { createSourceRef, sourceId } from "../source-model";
import { getSubjectSearchQuery } from "../subject-config";
import { OUTLET_TO_MEDIA_TYPE } from "./news";

const GUARDIAN_API_BASE = "https://content.guardianapis.com/search";
const OUTLET = "The Guardian";

function getMediaType(): MediaType {
  return OUTLET_TO_MEDIA_TYPE[OUTLET] ?? OUTLET_TO_MEDIA_TYPE["Guardian"] ?? "broadsheet";
}

export interface GuardianResult {
  id?: string;
  type?: string;
  sectionId?: string;
  sectionName?: string;
  webPublicationDate?: string;
  webTitle?: string;
  webUrl?: string;
  apiUrl?: string;
  fields?: { trailText?: string; headline?: string };
}

export interface GuardianSearchResponse {
  response?: {
    status?: string;
    total?: number;
    results?: GuardianResult[];
  };
}

/**
 * Fetch articles from Guardian Open Platform (search) for the subject and window.
 * Requires GUARDIAN_API_KEY in env. Returns items + sources for pipeline.
 */
export async function collectGuardianFromApi(
  subjectId: string,
  windowDays: number = 90
): Promise<{ items: RawMediaItem[]; sources: SourceRef[] }> {
  const apiKey = process.env.GUARDIAN_API_KEY;
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
    "api-key": apiKey.trim(),
    q,
    "from-date": fromStr,
    "to-date": toStr,
    "order-by": "newest",
    "page-size": "50",
    "show-fields": "trailText,headline",
  });

  const url = `${GUARDIAN_API_BASE}?${params.toString()}`;
  const items: RawMediaItem[] = [];
  const sources: SourceRef[] = [];
  const seen = new Set<string>();
  const retrieved_at = new Date().toISOString().slice(0, 19) + "Z";

  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
    console.log("[guardian-api] calling Guardian API: q =", q, ", from", fromStr, "to", toStr);
  }

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
        console.warn("[guardian-api] Guardian API request failed:", res.status, body.slice(0, 200));
      }
      return { items, sources };
    }
    const data = (await res.json()) as GuardianSearchResponse;
    const response = data.response;
    if (response?.status !== "ok" || !Array.isArray(response.results)) {
      return { items, sources };
    }
    if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
      console.log("[guardian-api] Guardian API response: total =", response.total, ", results =", response.results.length);
    }

    for (let i = 0; i < response.results.length; i++) {
      const r = response.results[i];
      const title = (r.webTitle ?? r.fields?.headline ?? "").trim();
      if (!title) continue;
      const url = (r.webUrl ?? "").trim();
      const publishedAt = r.webPublicationDate ?? new Date().toISOString();
      const dedupeKey = url && url.startsWith("http") ? url : (title + OUTLET + publishedAt.slice(0, 10)).toLowerCase().replace(/\s+/g, " ");
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const id = `guardian_api_${Date.now()}_${i}`;
      const srcId = sourceId("news", id);
      const ref = createSourceRef(srcId, title.slice(0, 80), "news_headline", "media_framing", {
        publisher: OUTLET,
        published_at: publishedAt.slice(0, 10),
        url: url || undefined,
        retrieved_at,
      });
      sources.push(ref);
      const lede = (r.fields?.trailText ?? "").slice(0, 300).trim() || undefined;
      items.push({
        id: srcId,
        outlet: OUTLET,
        media_type: getMediaType(),
        title,
        lede,
        url: url || undefined,
        published_at: publishedAt,
        retrieved_at,
      });
    }
  } catch (err) {
    if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
      console.warn("[guardian-api] Guardian API fetch error:", err instanceof Error ? err.message : err);
    }
  }

  return { items, sources };
}
