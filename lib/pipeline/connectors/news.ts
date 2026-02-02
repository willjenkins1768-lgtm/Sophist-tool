/**
 * Live news connector: RSS feeds, filter by subject keywords, store as SourceRef(media_framing).
 * Real data only; media_type from outlet mapping; dedupe by URL or hash(title+outlet+date).
 */

import type { RawMediaItem, MediaType } from "../types";
import type { SourceRef } from "../source-model";
import { createSourceRef, sourceId } from "../source-model";
import { getSubjectKeywords } from "../subject-config";

/** Outlet → media type for breakdown (broadcast/broadsheet/tabloid/online/wire). */
export const OUTLET_TO_MEDIA_TYPE: Record<string, MediaType> = {
  BBC: "broadcast",
  "Sky News": "broadcast",
  "Sky": "broadcast",
  "ITV News": "broadcast",
  "Channel 4 News": "broadcast",
  "The Guardian": "broadsheet",
  "Guardian": "broadsheet",
  "The Times": "broadsheet",
  "Times": "broadsheet",
  "The Telegraph": "broadsheet",
  "Telegraph": "broadsheet",
  "Financial Times": "broadsheet",
  "FT": "broadsheet",
  "The Independent": "broadsheet",
  "Independent": "broadsheet",
  "Daily Mail": "tabloid",
  "Mail": "tabloid",
  "The Sun": "tabloid",
  "Sun": "tabloid",
  "Mirror": "tabloid",
  "Daily Mirror": "tabloid",
  "Express": "tabloid",
  "Reuters": "wire",
  "PA Media": "wire",
  "PA": "wire",
  "Press Association": "wire",
};

function getMediaType(outlet: string): MediaType {
  const normalized = outlet.trim();
  return OUTLET_TO_MEDIA_TYPE[normalized] ?? OUTLET_TO_MEDIA_TYPE[normalized.replace(/^The\s+/i, "")] ?? "online";
}

/** Feed URL and display name for outlet. Widen coverage for more complete media breakdown. */
const UK_RSS_FEEDS: { url: string; outlet: string }[] = [
  { url: "https://feeds.bbci.co.uk/news/uk/rss.xml", outlet: "BBC" },
  { url: "https://feeds.bbci.co.uk/news/politics/rss.xml", outlet: "BBC" },
  { url: "https://www.theguardian.com/uk-news/rss", outlet: "The Guardian" },
  { url: "https://www.theguardian.com/politics/rss", outlet: "The Guardian" },
  { url: "https://feeds.skynews.com/uk/rss.xml", outlet: "Sky News" },
  { url: "https://feeds.skynews.com/uk/politics/rss.xml", outlet: "Sky News" },
  { url: "https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best", outlet: "Reuters" },
  { url: "https://www.telegraph.co.uk/news/rss.xml", outlet: "The Telegraph" },
  { url: "https://www.telegraph.co.uk/politics/rss.xml", outlet: "The Telegraph" },
  { url: "https://www.independent.co.uk/news/uk/rss", outlet: "The Independent" },
  { url: "https://www.independent.co.uk/news/politics/rss", outlet: "The Independent" },
  { url: "https://www.dailymail.co.uk/news/index.rss", outlet: "Daily Mail" },
  { url: "https://www.mirror.co.uk/news/rss.xml", outlet: "Daily Mirror" },
];

function matchSubject(title: string, description: string, keywords: string[]): boolean {
  const text = (title + " " + description).toLowerCase();
  return keywords.some((k) => text.includes(k.toLowerCase()));
}

function parseRssXml(xml: string, feedUrl: string): { title: string; link?: string; pubDate?: string; description?: string }[] {
  const items: { title: string; link?: string; pubDate?: string; description?: string }[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
    const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim();
    const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim();
    const description = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
    if (title) items.push({ title, link, pubDate, description });
  }
  return items;
}

function parsePubDate(s: string | undefined): string {
  if (!s) return new Date().toISOString();
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export async function collectNewsHeadlines(
  subjectId: string,
  windowDays: number = 14
): Promise<{ items: RawMediaItem[]; sources: SourceRef[] }> {
  const items: RawMediaItem[] = [];
  const sources: SourceRef[] = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  const seen = new Set<string>();
  const retrieved_at = new Date().toISOString().slice(0, 19) + "Z";
  const keywords = getSubjectKeywords(subjectId);

  for (const { url: feedUrl, outlet } of UK_RSS_FEEDS) {
    try {
      const res = await fetch(feedUrl, {
        headers: { "User-Agent": "DRCM-Sophist-Tool/1.0 (research)" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const parsed = parseRssXml(xml, feedUrl);
      const media_type = getMediaType(outlet);

      for (const p of parsed) {
        if (!matchSubject(p.title, p.description ?? "", keywords)) continue;
        const published_at = parsePubDate(p.pubDate);
        if (new Date(published_at) < cutoff) continue;
        const dedupeKey = (p.link && p.link.startsWith("http"))
          ? p.link
          : (p.title + outlet + published_at.slice(0, 10)).toLowerCase().replace(/\s+/g, " ");
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const id = `news_${Date.now()}_${items.length}`;
        const srcId = sourceId("news", id);
        const ref = createSourceRef(srcId, p.title, "news_headline", "media_framing", {
          publisher: outlet,
          published_at: published_at.slice(0, 10),
          url: p.link,
          retrieved_at,
        });
        sources.push(ref);
        items.push({
          id: srcId,
          outlet,
          media_type,
          title: p.title,
          lede: p.description?.slice(0, 200),
          url: p.link,
          published_at,
          retrieved_at,
        });
      }
    } catch {
      // Skip feed on error; real data only, no mock
    }
  }

  return { items, sources };
}
