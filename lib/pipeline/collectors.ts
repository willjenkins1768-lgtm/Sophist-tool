/**
 * Collectors: fetch raw media, polls, metrics. v1 uses mocks; swap for real APIs later.
 */

import type { RawMediaItem, RawPollItem, RawMetricItem } from "./types";
import { MOCK_MEDIA_HEADLINES, MOCK_POLLS, MOCK_REALITY_METRICS } from "./mocks";

const SUBJECT_MEDIA_FILTER: Record<string, boolean> = { small_boats: true };

export async function collect_media_headlines(
  subject_id: string,
  window_days: number = 14
): Promise<RawMediaItem[]> {
  if (!SUBJECT_MEDIA_FILTER[subject_id]) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - window_days);
  const items = MOCK_MEDIA_HEADLINES.filter((m) => new Date(m.published_at) >= cutoff);
  return items;
}

export async function collect_polls(subject_id: string): Promise<RawPollItem[]> {
  if (subject_id !== "small_boats") return [];
  return [...MOCK_POLLS];
}

export async function collect_reality_metrics(subject_id: string): Promise<RawMetricItem[]> {
  if (subject_id !== "small_boats") return [];
  return [...MOCK_REALITY_METRICS];
}
