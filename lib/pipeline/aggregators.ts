/**
 * Aggregators: media framing, public polling, reality metrics (time-window summaries).
 */

import type { PipelineRespectId } from "./taxonomy";
import type {
  ClassifiedItem,
  RawMediaItem,
  RawPollItem,
  RawMetricItem,
  MediaFramingAggregate,
  PublicPollingAggregate,
  RealityMetricsAggregate,
  MediaExemplar,
  SupportingPoll,
  RealityMetricEntry,
  MediaType,
  MediaTypeBreakdown,
  PollQuestion,
} from "./types";
const STOPWORDS = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "can", "new", "says"]);

function topPhrasesFromHeadlines(headlines: { title: string }[], n: number = 10): string[] {
  const counts = new Map<string, number>();
  for (const h of headlines) {
    const tokens = h.title
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t));
    for (const t of tokens) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([w]) => w);
}

function recencyDecay(daysAgo: number): number {
  return Math.max(0.1, 1 - daysAgo / 14);
}

const OUTLET_TO_MEDIA_TYPE: Record<string, MediaType> = {
  bbc: "broadcast", "sky news": "broadcast", sky: "broadcast",
  "the guardian": "broadsheet", guardian: "broadsheet", "the times": "broadsheet", times: "broadsheet",
  "the telegraph": "broadsheet", telegraph: "broadsheet", "financial times": "broadsheet",
  "the independent": "broadsheet", independent: "broadsheet",
  "daily mail": "tabloid", mail: "tabloid", "the sun": "tabloid", sun: "tabloid", mirror: "tabloid", express: "tabloid",
  reuters: "wire", "pa media": "wire", "press association": "wire",
};

function getMediaType(item: RawMediaItem): MediaType {
  if (item.media_type) return item.media_type;
  const key = item.outlet.toLowerCase().trim().replace(/^the\s+/, "");
  return OUTLET_TO_MEDIA_TYPE[key] ?? "online";
}

export function aggregate_media_framing(
  subject_id: string,
  classified: ClassifiedItem[],
  rawMedia: RawMediaItem[],
  window_days: number = 14
): MediaFramingAggregate {
  const mediaClassified = classified.filter((c) => c.item_type === "media");
  const now = Date.now();
  const windowFrom = new Date(now);
  windowFrom.setDate(windowFrom.getDate() - window_days);
  const windowTo = new Date(now);

  const byRespect = new Map<PipelineRespectId, number>();
  const itemWeights: { itemId: string; weight: number }[] = [];

  for (const c of mediaClassified) {
    const raw = rawMedia.find((m) => m.id === c.item_id);
    const published = raw ? new Date(raw.published_at).getTime() : now;
    const daysAgo = (now - published) / (24 * 60 * 60 * 1000);
    const weight = recencyDecay(daysAgo) * c.confidence;
    byRespect.set(c.respect_id, (byRespect.get(c.respect_id) ?? 0) + weight);
    itemWeights.push({ itemId: c.item_id, weight });
  }

  const total = Array.from(byRespect.values()).reduce((a, b) => a + b, 0) || 1;
  const shares = Array.from(byRespect.entries())
    .map(([respect_id, sum]) => ({ respect_id, share: sum / total }))
    .sort((a, b) => b.share - a.share);

  const dominant = shares[0] ?? { respect_id: "security_border" as PipelineRespectId, share: 0.5 };
  const topPhrases = topPhrasesFromHeadlines(rawMedia.map((m) => ({ title: m.title })));
  itemWeights.sort((a, b) => b.weight - a.weight);

  const classifiedByItem = new Map(mediaClassified.map((c) => [c.item_id, c]));
  const exemplars: MediaExemplar[] = itemWeights
    .slice(0, 5)
    .map(({ itemId }) => rawMedia.find((x) => x.id === itemId))
    .filter((m): m is NonNullable<typeof m> => m != null)
    .slice(0, 6)
    .map((m) => {
      const c = classifiedByItem.get(m.id);
      return {
        source_id: m.id,
        outlet: m.outlet,
        title: m.title,
        url: m.url,
        published_at: m.published_at,
        respect_id: c?.respect_id,
        confidence: c?.confidence,
      };
    });

  const source_ids = Array.from(new Set(rawMedia.map((m) => m.id)));

  const nTotal = rawMedia.length;
  const byMediaType = new Map<MediaType, { items: RawMediaItem[]; classified: ClassifiedItem[] }>();
  for (const m of rawMedia) {
    const mt = getMediaType(m);
    if (!byMediaType.has(mt)) byMediaType.set(mt, { items: [], classified: [] });
    byMediaType.get(mt)!.items.push(m);
  }
  for (const c of mediaClassified) {
    const raw = rawMedia.find((m) => m.id === c.item_id);
    if (raw) {
      const mt = getMediaType(raw);
      byMediaType.get(mt)?.classified.push(c);
    }
  }
  const media_type_breakdown: MediaTypeBreakdown[] = [];
  for (const [media_type, { items: typeItems, classified: typeClassified }] of Array.from(byMediaType.entries())) {
    const typeByRespect = new Map<PipelineRespectId, number>();
    for (const c of typeClassified) {
      const raw = typeItems.find((m) => m.id === c.item_id);
      const published = raw ? new Date(raw.published_at).getTime() : now;
      const daysAgo = (now - published) / (24 * 60 * 60 * 1000);
      const w = recencyDecay(daysAgo) * c.confidence;
      typeByRespect.set(c.respect_id, (typeByRespect.get(c.respect_id) ?? 0) + w);
    }
    const typeTotal = Array.from(typeByRespect.values()).reduce((a, b) => a + b, 0) || 1;
    const typeShares = Array.from(typeByRespect.entries())
      .map(([respect_id, sum]) => ({ respect_id, share: sum / typeTotal }))
      .sort((a, b) => b.share - a.share);
    media_type_breakdown.push({
      media_type,
      n: typeItems.length,
      weight: nTotal > 0 ? typeItems.length / nTotal : 0,
      shares: typeShares,
    });
  }
  media_type_breakdown.sort((a, b) => b.n - a.n);

  return {
    window: { from: windowFrom.toISOString().slice(0, 10), to: windowTo.toISOString().slice(0, 10) },
    dominant: { respect_id: dominant.respect_id, share: dominant.share },
    shares,
    top_phrases: topPhrases,
    exemplars,
    source_ids,
    volume: nTotal,
    media_type_breakdown,
  };
}

const POLL_OPTION_TO_RESPECT: { pattern: RegExp; respect_id: PipelineRespectId }[] = [
  { pattern: /tough|stop|reduce|control|border|crackdown/i, respect_id: "security_border" },
  { pattern: /humane|protect|refugee|dignity|safe/i, respect_id: "humanitarian" },
  { pattern: /legal|law|ECHR|process/i, respect_id: "rule_of_law" },
  { pattern: /sovereignty|take back/i, respect_id: "sovereignty_control" },
];

function mapPollToRespectShare(poll: RawPollItem): { respect_id: PipelineRespectId; share: number }[] {
  const out: { respect_id: PipelineRespectId; share: number }[] = [];
  for (let i = 0; i < poll.options.length; i++) {
    const opt = poll.options[i];
    const pct = poll.results[i] ?? 0;
    for (const { pattern, respect_id } of POLL_OPTION_TO_RESPECT) {
      if (pattern.test(opt)) {
        const existing = out.find((o) => o.respect_id === respect_id);
        if (existing) existing.share += pct;
        else out.push({ respect_id, share: pct });
        break;
      }
    }
  }
  if (out.length === 0) out.push({ respect_id: "security_border", share: 0.5 });
  return out;
}

export function aggregate_public_polling(
  subject_id: string,
  classified: ClassifiedItem[],
  rawPolls: RawPollItem[],
  window_months: number = 6
): PublicPollingAggregate {
  const pollClassified = classified.filter((c) => c.item_type === "poll");
  const byRespect = new Map<PipelineRespectId, number>();
  for (const c of pollClassified) {
    const poll = rawPolls.find((p) => p.id === c.item_id);
    if (!poll) continue;
    const mapped = mapPollToRespectShare(poll);
    for (const { respect_id, share } of mapped) {
      byRespect.set(respect_id, (byRespect.get(respect_id) ?? 0) + share * c.confidence);
    }
  }
  const total = Array.from(byRespect.values()).reduce((a, b) => a + b, 0) || 1;
  const sorted = Array.from(byRespect.entries())
    .map(([respect_id, v]) => ({ respect_id, share: v / total }))
    .sort((a, b) => b.share - a.share);
  const public_prior = sorted[0] ?? { respect_id: "security_border" as PipelineRespectId, share: 0.5 };

  const windowFrom = new Date();
  windowFrom.setMonth(windowFrom.getMonth() - window_months);
  const windowTo = new Date();

  const splitParts = sorted.slice(0, 2).map((s) => `${Math.round(s.share * 100)}% ${s.respect_id.replace(/_/g, " ")}`);
  const split_summary = splitParts.length >= 2
    ? `${splitParts[0]} vs ${splitParts[1]}`
    : rawPolls.length === 0 ? "No polling data in window" : "Insufficient poll data";
  const trend_summary = rawPolls.length >= 2 ? "Based on polls in window (recency-weighted)." : "Insufficient data for trend.";

  const supporting_polls: SupportingPoll[] = rawPolls.slice(0, 10).map((p) => ({
    source_id: p.id,
    pollster: p.pollster,
    question: p.question,
    fieldwork_dates: p.fieldwork_dates,
    published_at: p.published_at,
    url: p.url,
  }));
  const source_ids = Array.from(new Set(rawPolls.map((p) => p.id)));

  const question_level: PollQuestion[] = rawPolls.map((p) => {
    const mapped = mapPollToRespectShare(p);
    const primary = mapped.sort((a, b) => b.share - a.share)[0] ?? { respect_id: "security_border" as PipelineRespectId, share: 0 };
    const option_results =
      p.options.length > 0 && p.options.length === p.results.length
        ? p.options.map((opt, i) => ({ option: opt, pct: Math.round((p.results[i] ?? 0) * 100) }))
        : undefined;
    return {
      source_id: p.id,
      pollster: p.pollster,
      fieldwork_dates: p.fieldwork_dates,
      question: p.question,
      mapped_respect: primary.respect_id,
      result_pct: Math.round(primary.share * 100),
      sample_size: p.sample_size,
      url: p.url,
      option_results,
    };
  });

  return {
    window: { from: windowFrom.toISOString().slice(0, 10), to: windowTo.toISOString().slice(0, 10) },
    public_prior,
    shares: sorted.slice(0, 5),
    split_summary,
    trend_summary,
    supporting_polls,
    source_ids,
    question_level,
  };
}

const SMALL_BOATS_READING_TEMPLATES: Partial<Record<PipelineRespectId, (m: RawMetricItem, dir: string) => string>> = {
  security_border: (m, dir) =>
    dir === "down" ? "Deterrence working; still a threat, need to sustain." : "Routes riskier; deterrence message.",
  humanitarian: (m, dir) =>
    dir === "up" ? "Safe routes would save lives; humanitarian frame gains." : "Route more dangerous; need safe pathways.",
  rule_of_law: () => "System failure intensifies legal risk.",
  capacity_delivery: (m) => `Backlog and processing: ${m.label} ${m.latest_value > m.previous_value ? "worsening" : "improving"}.`,
};

export function aggregate_reality_metrics(
  subject_id: string,
  rawMetrics: RawMetricItem[]
): RealityMetricsAggregate {
  const metrics: RealityMetricEntry[] = rawMetrics.map((m) => {
    const delta = m.latest_value - m.previous_value;
    const delta_pct = m.previous_value === 0 ? 0 : (delta / m.previous_value) * 100;
    const direction: "up" | "down" | "flat" = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    const respects: PipelineRespectId[] = ["security_border", "humanitarian", "rule_of_law"];
    const readings = respects.map((respect_id) => {
      const template = SMALL_BOATS_READING_TEMPLATES[respect_id];
      const text = template ? template(m, direction) : `${respect_id}: metric ${direction}.`;
      return { respect_id, text };
    });
    return {
      metric_id: m.metric_id,
      label: m.label,
      unit: m.unit,
      latest: m.latest_value,
      previous: m.previous_value,
      delta,
      delta_pct,
      direction,
      readings,
      source_id: m.source_ref,
    };
  });

  const updated_at = rawMetrics.length > 0
    ? rawMetrics.map((m) => m.updated_at).sort().reverse()[0]
    : new Date().toISOString();
  const source_ids = Array.from(new Set(rawMetrics.map((m) => m.source_ref).filter(Boolean) as string[]));

  return { updated_at, metrics, source_ids };
}
